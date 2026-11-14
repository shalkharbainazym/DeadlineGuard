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
  // Friendly names for common US merchants (raw bank descriptors are cryptic, e.g. "AUDIBLE*ADBL 2K4")
  const ALIASES = [
    [/^NETFLIX/, "Netflix"], [/^SPOTIFY/, "Spotify"], [/^HULU/, "Hulu"], [/^AUDIBLE/, "Audible"],
    [/^APPLE( BILL)?$/, "Apple (iCloud / App Store)"], [/^ADOBE/, "Adobe Creative Cloud"], [/^AMAZON PRIME|^PRIME VIDEO/, "Amazon Prime"],
    [/^AMAZON|^AMZN/, "Amazon"], [/^COMCAST|^XFINITY/, "Comcast Xfinity"], [/^DISNEY/, "Disney+"], [/^YOUTUBE/, "YouTube Premium"],
    [/^MAX\b|^HBO/, "Max"], [/^PARAMOUNT/, "Paramount+"], [/^PEACOCK/, "Peacock"], [/^CHATGPT|^OPENAI/, "ChatGPT Plus"],
    [/^DROPBOX/, "Dropbox"], [/^MICROSOFT|^MSFT/, "Microsoft 365"], [/^PLANET FIT/, "Planet Fitness"], [/^IRONHOUSE/, "Ironhouse Fitness"],
    [/^VERIZON/, "Verizon"], [/^T MOBILE|^TMOBILE/, "T-Mobile"], [/^AT&T|^ATT\b/, "AT&T"], [/^DOORDASH|^DASHPASS/, "DoorDash"],
  ];
  const pretty = (k) => {
    for (const [re, name] of ALIASES) if (re.test(k)) return name;
    return k.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

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
        const since = uniq.filter((t) => t.date > prev.date && t.amt > prev.amt * 1.02);
        findings.priceHikes.push({ name: sub.name, from: prev.amt, to: last.amt, date: last.date, annualImpact: round2((last.amt - prev.amt) * perYear),
          chargesSince: since.length, extraSoFar: round2(since.reduce((s, t) => s + (t.amt - prev.amt), 0)) });
      }
      // Free trial that turned into a paid plan
      if (list[0].amt < 1.01) {
        const trialStart = list[0];
        if (trialStart.date < uniq[0].date) {
          findings.trials.push({ name: sub.name, trialDate: trialStart.date, amount: last.amt, annual: sub.annual,
            charges: uniq.length, paidSoFar: round2(uniq.reduce((s, t) => s + t.amt, 0)) });
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

  // Money already gone during the statement period (not a forecast)
  function alreadyLost(f) {
    const rows = [];
    const feeTotal = f.fees.reduce((s, x) => s + x.amount, 0);
    if (f.fees.length) rows.push({ kind: "fee", name: "Bank fees", detail: f.fees.map((x) => x.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())).join(", "), amount: round2(feeTotal), count: f.fees.length, recoverable: true });
    f.duplicates.forEach((x) => rows.push({ kind: "dup", name: x.name, detail: "Charged twice for the same purchase", amount: x.amount, date: x.date, recoverable: true }));
    f.trials.forEach((x) => rows.push({ kind: "trial", name: x.name, detail: `Free trial turned paid — ${x.charges || 0} charge${x.charges === 1 ? "" : "s"} so far`, amount: x.paidSoFar || 0, recoverable: false, ref: x }));
    f.priceHikes.forEach((x) => rows.push({ kind: "hike", name: x.name, detail: `Price went up $${x.from.toFixed(2)} → $${x.to.toFixed(2)} — extra paid since`, amount: x.extraSoFar || 0, recoverable: false, ref: x }));
    // calendar months covered by the statement (same rule as spending())
    const months = f.period ? Math.max(1, (f.period.to.getUTCFullYear() - f.period.from.getUTCFullYear()) * 12 + f.period.to.getUTCMonth() - f.period.from.getUTCMonth() + 1) : 1;
    const total = round2(rows.reduce((s, r) => s + r.amount, 0));
    return { total, months, rows: rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount),
      recoverable: round2(rows.filter((r) => r.recoverable).reduce((s, r) => s + r.amount, 0)) };
  }

  // ---------- Spending categories (simple keyword rules, first match wins) ----------
  const SPEND_CATS = [
    ["Bank fees", FEE_RE],
    ["Food delivery & dining", /(UBER ?EATS|DOORDASH|GRUBHUB|POSTMATES|SEAMLESS|CAVIAR|STARBUCKS|DUNKIN|MCDONALD|CHIPOTLE|CHICK-?FIL|TACO BELL|WENDY|BURGER|PIZZA|SUBWAY|PANERA|SWEETGREEN|RESTAURANT|CAFE|COFFEE|DINER|GRILL|KITCHEN)/i],
    ["Subscriptions", /(NETFLIX|SPOTIFY|HULU|AUDIBLE|APPLE\.COM\/BILL|APPLE BILL|ITUNES|ADOBE|DISNEY|HBO|\bMAX\b|YOUTUBE|PRIME VIDEO|PARAMOUNT|PEACOCK|DROPBOX|MICROSOFT|ICLOUD|CHATGPT|OPENAI|FITNESS|\bGYM\b|PATREON|SIRIUS)/i],
    ["Housing", /(\bRENT\b|MORTGAGE|\bAPTS?\b|APARTMENT|PROPERTY|\bHOA\b|COMCAST|XFINITY|SPECTRUM|INTERNET|ELECTRIC|UTILIT|WATER|PG&E|CON ED|ENERGY|VERIZON|AT&T|T-MOBILE)/i],
    ["Groceries", /(TRADER JOE|SAFEWAY|KROGER|WHOLE FOODS|ALDI|PUBLIX|H-E-B|\bHEB\b|WEGMANS|SPROUTS|GROCERY|SUPERMARKET|FOOD LION|ALBERTSONS|COSTCO)/i],
    ["Transport", /(UBER|LYFT|CHEVRON|SHELL|EXXON|MOBIL|\bBP\b|SUNOCO|VALERO|\bGAS\b|FUEL|PARKING|TRANSIT|METRO|TOLL|\bDMV\b|GEICO|PROGRESSIVE|STATE FARM)/i],
    ["Shopping", /(AMAZON|AMZN|TARGET|WALMART|BEST BUY|EBAY|ETSY|IKEA|HOME DEPOT|LOWE'?S|NIKE|ZARA|H&M|MACY|NORDSTROM|SEPHORA|ULTA)/i],
  ];
  const CAT_ORDER = ["Housing", "Groceries", "Food delivery & dining", "Transport", "Subscriptions", "Other", "Shopping", "Bank fees"]; // fixed order = fixed color slot
  const NOT_SPENDING = /(TRANSFER TO|TO SAVINGS|CREDIT CARD PAYMENT|AUTOPAY PAYMENT|PAYMENT THANK YOU|INVESTMENT|BROKERAGE)/i;
  const STREAMING = /(NETFLIX|HULU|SPOTIFY|DISNEY|HBO|\bMAX\b|YOUTUBE|PARAMOUNT|PEACOCK|PRIME VIDEO)/i;
  function categoryOf(desc) { for (const [name, re] of SPEND_CATS) if (re.test(desc)) return name; return "Other"; }
  function spending(tx) {
    const out = tx.filter((t) => t.amount < 0 && !NOT_SPENDING.test(t.desc));
    const totals = Object.fromEntries(CAT_ORDER.map((c) => [c, { name: c, total: 0, count: 0 }]));
    let streaming = 0;
    for (const t of out) {
      const c = totals[categoryOf(t.desc)]; c.total += -t.amount; c.count++;
      if (STREAMING.test(t.desc)) streaming += -t.amount;
    }
    // number of calendar months covered by the statement (monthly bills like rent appear once per month)
    const months = Math.max(1, new Set(tx.map((t) => t.date.getUTCFullYear() + "-" + t.date.getUTCMonth())).size);
    const cats = CAT_ORDER.map((c) => totals[c]).map((c) => ({ ...c, total: round2(c.total), monthly: round2(c.total / months) }));
    const total = round2(cats.reduce((s, c) => s + c.total, 0));
    return { months: round2(months), total, monthly: round2(total / months), cats, streamingMonthly: round2(streaming / months) };
  }

  const api = { parseCSV, normalizeTransactions, merchantKey, detectLeaks, summarize, alreadyLost, spending, categoryOf, CAT_ORDER };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Leaks = api;
})(typeof window !== "undefined" ? window : globalThis);
