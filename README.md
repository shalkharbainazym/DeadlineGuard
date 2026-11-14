# DeadlineGuard 🛡️

**Adulting gets expensive when you miss a deadline.**
DeadlineGuard reads your insurance policies, lease, receipts/warranties, benefits statements and bank statement, finds every date and money leak that can cost you money, and tells you exactly what to do.

Built for **Business Cup 2.0 — From Zero to Product in 24H** (Money track).

## What it does
- 📄 **AI document reader** — upload a PDF/photo; AI extracts deadlines, amounts, auto-renewals, notice periods and hidden costs.
- 💰 **Money-at-risk score** — "you could lose $X in the next 12 months".
- 🔁 **Bank statement scan (CSV, runs in the browser)** — recurring subscriptions, price hikes, free trials that turned paid, duplicate charges, bank fees.
- ✉️ **Ready-to-send emails & call scripts** (Pro).
- 📆 **Calendar reminders** (.ics for Google/Apple/Outlook) (Pro).
- 🔒 **Privacy-first** — no bank login, files are not stored, data stays in your browser (localStorage).

## Tech
Plain HTML/CSS/JS (no build step) + one serverless function `api/analyze.js` (Vercel) that calls Claude (Anthropic) or OpenAI.

```
index.html          # the whole web app
js/leaks.js         # subscription / fee / duplicate detection (pure JS, testable)
api/analyze.js      # AI document analysis endpoint (Vercel function)
samples/            # fictional demo documents + bank statement CSV
server.js           # local dev server (no npm install needed)
```

## Run locally
```bash
# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."     # or $env:OPENAI_API_KEY="sk-..."
node server.js
# open http://localhost:3000
```

## Deploy (Vercel)
1. vercel.com → **Add New → Project** → import this GitHub repo → Deploy (no settings needed).
2. Project → **Settings → Environment Variables** → add `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) → **Redeploy**.
3. Open the URL and click **Try with sample documents**.

## Business model
Free: 5 documents, deadlines, money-at-risk score, subscription scan.
Pro: $5/month or $49/year — unlimited documents, AI emails & scripts, calendar reminders.

---
*Sample documents are fictional. DeadlineGuard provides general information, not legal, tax or financial advice.*
