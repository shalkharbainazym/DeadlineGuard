// DeadlineGuard — bank statement leak detector (runs 100% in the browser; works in Node for tests)
(function (root) {
  // ---------- CSV parsing ----------
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some((c) => c.trim() !== "")) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    return rows;
  }

  function toNumber(s) {
    if (s == null) return NaN;
    let t = String(s).trim();
    const neg = /^\(.*\)$/.test(t) || t.startsWith("-");
    t = t.replace(/[()$,\s-]/g, "");
    const n = parseFloat(t);
    return isNaN(n) ? NaN : neg ? -n : n;
  }

  function toDate(s) {
    const t = String(s).trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(Date.UTC(y, +m[1] - 1, +m[2])); }
    const d = new Date(t);
    return isNaN(d) ? null : d;
  }

  // Map any common bank CSV layout to {date, desc, amount}; amount < 0 means money out
  function normalizeTransactions(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error("The CSV looks empty.");
    const head = rows[0].map((h) => h.toLowerCase().trim());
    const find = (...keys) => head.findIndex((h) => keys.some((k) => h.includes(k)));
    const iDate = find("date", "posted");
    const iDesc = find("description", "merchant", "payee", "name", "details", "memo");
    const iAmt = find("amount");
    const iDebit = find("debit", "withdrawal");
    const iCredit = find("credit", "deposit");
    if (iDate < 0 || iDesc < 0 || (iAmt < 0 && iDebit < 0)) {
      throw new Error("Could not find Date / Description / Amount columns in this CSV.");
    }
    const tx = [];
    for (const r of rows.slice(1)) {
      const date = toDate(r[iDate]);
      const desc = (r[iDesc] || "").trim();
      let amount;
      if (iAmt >= 0) amount = toNumber(r[iAmt]);
      else {
        const d = toNumber(r[iDebit]), c = toNumber(r[iCredit]);
        amount = !isNaN(d) && d !== 0 ? -Math.abs(d) : !isNaN(c) ? Math.abs(c) : NaN;
      }
      if (!date || !desc || isNaN(amount)) continue;
      tx.push({ date, desc, amount });
    }
    // Some banks export debits as positive numbers: if almost everything is positive, flip sign
    const pos = tx.filter((t) => t.amount > 0).length;
    if (tx.length && pos / tx.length > 0.9 && iAmt >= 0) tx.forEach((t) => (t.amount = -t.amount));
    return tx.sort((a, b) => a.date - b.date);
  }

  // ---------- Merchant normalization ----------
  const NOISE = /^(POS|DEBIT|CARD|PURCHASE|RECURRING|PAYMENT|ACH|CHECKCARD|VISA|MC|SQ|TST|PAYPAL|PP|APL|GOOGLE|WWW|ONLINE)\b/;
  function merchantKey(desc) {
    let s = desc.toUpperCase();
    s = s.replace(/\.(COM|NET|ORG|IO)\b/g, " ");
    s = s.replace(/\*/g, " ").replace(/[^A-Z0-9 &']/g, " ");
    s = s.replace(/\b(COM|INC|LLC|CO|USA|US|HTTPS?|WWW)\b/g, " ");
    s = s.replace(/\b[A-Z]*\d[A-Z0-9]*\b/g, " "); // ids, phone numbers, store numbers
    s = s.replace(/\s+/g, " ").trim();
    let words = s.split(" ").filter(Boolean);
    while (words.length > 1 && NOISE.test(words[0])) words.shift();
    words = words.filter((w) => w.length > 1 || words.length === 1);
    return words.slice(0, 2).join(" ") || desc.toUpperCase().slice(0, 20);
  }
  const pretty = (k) => k.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const DAY = 86400000;
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const round2 = (n) => Math.round(n * 100) / 100;

  const FEE_RE = /(OVERDRAFT|NSF|INSUFFICIENT FUNDS|ATM FEE|NON-NETWORK ATM|FOREIGN TRANSACTION|INTL TRANSACTION FEE|LATE FEE|LATE PAYMENT|MONTHLY MAINTENANCE|SERVICE FEE|SERVICE CHARGE|RETURNED ITEM|WIRE FEE)/i;
  const NOT_SUBSCRIPTION = /(RENT|MORTGAGE|PAYROLL|DEPOSIT|TRANSFER|ZELLE|VENMO|CASH APP|ATM WITHDRAWAL|GROCERY|SAFEWAY|KROGER|WALMART|TARGET|COSTCO|SHELL|CHEVRON|EXXON|UBER EATS|DOORDASH|STARBUCKS)/i;

  // ---------- Leak detection ----------
  function detectLeaks(tx) {
    const out = tx.filter((t) => t.amount < 0).map((t) => ({ ...t, amt: round2(-t.amount), key: merchantKey(t.desc) }));
    const findings = { subscriptions: [], priceHikes: [], trials: [], duplicates: [], fees: [], period: null };
    if (!tx.length) return findings;
    findings.period = { from: tx[0].date, to: tx[tx.length - 1].date };

    // Fees
    for (const t of out) if (FEE_RE.test(t.desc)) findings.fees.push({ name: t.desc, date: t.date, amount: t.amt });

    // Group by merchant
    const groups = {};
    for (const t of out) {
      if (FEE_RE.test(t.desc)) continue;
      (groups[t.key] = groups[t.key] || []).push(t);
    }
    // Free trials that started at $0.00 appear only in the original list (amount 0) — include them
    const zeroCharges = tx.filter((t) => t.amount === 0).map((t) => ({ ...t, amt: 0, key: merchantKey(t.desc) }));
    for (const z of zeroCharges) (groups[z.key] = groups[z.key] || []).unshift(z);

    for (const [key, list] of Object.entries(groups)) {
      list.sort((a, b) => a.date - b.date);
      // Duplicates: same merchant, same amount, same or next day
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i];
        if (a.amt > 0 && a.amt === b.amt && Math.abs(b.date - a.date) <= DAY) {
          findings.duplicates.push({ name: pretty(key), date: b.date, amount: b.amt });
        }
      }
      if (NOT_SUBSCRIPTION.test(key) || NOT_SUBSCRIPTION.test(list[0].desc)) continue;

      const paid = list.filter((t) => t.amt > 0);
      // collapse same-day duplicates for cadence analysis
      const uniq = paid.filter((t, i) => i === 0 || Math.abs(t.date - paid[i - 1].date) > DAY);
      if (uniq.length < 2) continue;
      const gaps = []; for (let i = 1; i < uniq.length; i++) gaps.push((uniq[i].date - uniq[i - 1].date) / DAY);
      const g = median(gaps);
      let cadence = null, perYear = 0;
      if (g >= 26 && g <= 35) { cadence = "monthly"; perYear = 12; }
      else if (g >= 6 && g <= 8) { cadence = "weekly"; perYear = 52; }
      else if (g >= 85 && g <= 95) { cadence = "quarterly"; perYear = 4; }
      else if (g >= 350 && g <= 380) { cadence = "yearly"; perYear = 1; }
      if (!cadence) continue;
      const amounts = uniq.map((t) => t.amt);
      const minA = Math.min(...amounts), maxA = Math.max(...amounts);
      if (maxA > minA * 1.6) continue; // too variable to be a subscription

      const last = uniq[uniq.length - 1];
      const sub = { name: pretty(key), cadence, amount: last.amt, annual: round2(last.amt * perYear), lastDate: last.date,
        nextDate: new Date(last.date.getTime() + g * DAY), charges: uniq.length };
      findings.subscriptions.push(sub);

      // Price hike: latest charge higher than the one before
      let prev = null;
      for (let i = uniq.length - 2; i >= 0; i--) if (Math.abs(uniq[i].amt - last.amt) > 0.009) { prev = uniq[i]; break; }
      if (prev && last.amt > prev.amt * 1.02) {
        findings.priceHikes.push({ name: sub.name, from: prev.amt, to: last.amt, date: last.date, annualImpact: round2((last.amt - prev.amt) * perYear) });
      }
      // Free trial that turned into a paid plan
      if (list[0].amt < 1.01) {
        const trialStart = list[0];
        if (trialStart.date < uniq[0].date) {
          findings.trials.push({ name: sub.name, trialDate: trialStart.date, amount: last.amt, annual: sub.annual });
        }
      }
    }
    findings.subscriptions.sort((a, b) => b.annual - a.annual);
    return findings;
  }

  function summarize(f) {
    const subsAnnual = f.subscriptions.reduce((s, x) => s + x.annual, 0);
    const hikeAnnual = f.priceHikes.reduce((s, x) => s + x.annualImpact, 0);
    const trialAnnual = f.trials.reduce((s, x) => s + x.annual, 0);
    const dupTotal = f.duplicates.reduce((s, x) => s + x.amount, 0);
    const feeTotal = f.fees.reduce((s, x) => s + x.amount, 0);
    let feeAnnual = feeTotal;
    if (f.period) {
      const months = Math.max(1, (f.period.to - f.period.from) / DAY / 30.4);
      feeAnnual = (feeTotal / months) * 12;
    }
    return {
      subsAnnual: round2(subsAnnual), hikeAnnual: round2(hikeAnnual), trialAnnual: round2(trialAnnual),
      dupTotal: round2(dupTotal), feeTotal: round2(feeTotal), feeAnnual: round2(feeAnnual),
      leakAnnual: round2(hikeAnnual + trialAnnual + dupTotal + feeAnnual),
    };
  }

  const api = { parseCSV, normalizeTransactions, merchantKey, detectLeaks, summarize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Leaks = api;
})(typeof window !== "undefined" ? window : globalThis);
