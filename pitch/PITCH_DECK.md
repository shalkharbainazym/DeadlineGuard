# DeadlineGuard — Pitch Deck (10 slides)

Текст слайдов — на английском (продукт для США). Под каждым слайдом — 🎤 заметки для выступления на русском.
Цифры с источниками помечены [n] — список в конце. Помеченное *assumption* — наши допущения, так и говорим.

---

## Slide 1 — Title
**DeadlineGuard**
**Adulting gets expensive when you miss a deadline.**
AI that reads your insurance, lease, receipts and bank statement — and shows every deadline in dollars, with one clear action.

🔗 deadlineguard-app.vercel.app · github.com/shalkharbainazym/DeadlineGuard
Business Cup 2.0 · Track: MONEY · Nazym Shalkharbay

🎤 «Взрослая жизнь дорого стоит, если пропустить дедлайн. DeadlineGuard — это AI, который читает ваши документы и показывает каждый дедлайн в долларах и одно действие, чтобы их не потерять.»

---

## Slide 2 — Problem
**Young adults lose money to dates, not decisions.**
- Insurance **auto-renews** at a higher price — our sample: **+18%, $256/yr**
- Lease needs **60-day notice** — miss it and rent jumps to month-to-month (+$250/mo)
- **40% of FSA holders forfeit** money every year — **$404 on average** [1]
- People underestimate subscriptions by **$133/month**; **42%** forgot they were paying for one [2]
- US banks & credit unions took **~$12.1B in overdraft/NSF fees** in 2024 [3]

The documents exist. Nobody reads the fine print or sets reminders.

🎤 Человек 25–45 лет впервые живёт сам: страховка, аренда, FSA на работе, 10 подписок. Деньги теряются не из‑за больших решений, а из‑за пропущенных дат и мелкого шрифта.

---

## Slide 3 — Who we sell to
**Primary user: "first-time adult" in the US, 25–45**
- Just moved out / first lease, first employer benefits (FSA/HSA), first own car insurance
- Busy, phone-first, has 5–15 subscriptions, hates paperwork
- Does **not** want to give a bank login to an app
- ~**90M** US adults aged 25–44 [4] — we start with renters with employer benefits (*assumption*: ~25M)

**Persona — Jordan, 28, Austin TX:** data analyst, rents, drives a 2019 Civic, has a $1,500 FSA, 8 subscriptions. Keeps paying for things they forgot about.

🎤 Мы продаём людям, не компаниям (B2C). Наш пользователь — Джордан: снимает квартиру, есть страховка и FSA, и он точно что‑то пропустит.

---

## Slide 4 — Solution
**Drop your paperwork → see your money at risk → act.**
1. **AI reads the document** (PDF / photo): deadlines, amounts, auto-renewals, notice periods, hidden fees
2. **Every deadline in dollars**: "$750 at risk by Dec 2"
3. **Bank CSV scan in the browser**: subscriptions, price hikes, trials → paid, duplicates, fees
4. **One action per risk**: ready-to-send email / call script + calendar reminder (Pro)
5. **Money protected score** grows as you handle deadlines

**Privacy-first:** no bank login · files never stored · data stays in the browser

🎤 Три шага: загрузил → увидел, сколько денег под риском → получил готовое действие. Без логина в банк.

---

## Slide 5 — Demo
**Live: deadlineguard-app.vercel.app → "Try with sample documents"** (no sign-up)
- 4 documents + 1 bank statement analyzed in **~10 seconds**
- **$2,500+ at risk in 12 months** found (sample household)
- Weekly risk chart, deadline calendar, "Next up" with *Act now / Soon / Handled*
- Leaks: 8 subscriptions, Netflix price hike, Audible trial → paid, Amazon duplicate, 4 bank fees = **$538/yr**
- Pro (test mode): ready emails + .ics reminders

*(screenshot of the dashboard)*

🎤 Показать вживую: нажать демо → главная цифра → график → открыть письмо в страховую → отметить «Mark handled» → кольцо «Money protected» растёт.

---

## Slide 6 — Market
**TAM:** ~90M US adults 25–44 [4] × $49/yr = **~$4.4B/yr**
**SAM** (*assumption*): ~25M renters with employer benefits and subscriptions → **~$1.2B/yr**
**SOM — Year 2 goal** (*assumption*): 50,000 paying users → **~$2.5M ARR**

Why now: subscription economy keeps growing, overdraft fees are rising again after the CFPB cap was repealed in 2025 [3], and multimodal AI can finally read messy PDFs and photos cheaply.

🎤 Рынок огромный, но мы начинаем с узкого сегмента: арендаторы с льготами от работодателя.

---

## Slide 7 — Competitors
| | **DeadlineGuard** | Rocket Money | Trustworthy |
|---|---|---|---|
| Core job | **Protect money: deadline → $ → action** | Budget & subscriptions | Family document vault |
| Bank login | **No (CSV)** | Required | No |
| Reads policies, leases, warranties, FSA | **Yes (AI)** | No | Stores, no $ risk |
| Ready emails / scripts | **Yes** | Negotiation only on Premium+ ($15/mo) [5] | No |
| Price | **$5/mo · $49/yr** | Premium ~$7–14/mo, Premium+ $15/mo [5] | Free + paid annual plans [6] |

**Our edge:** not a "document safe" and not a budget app — a **money-protection tool** that turns fine print into dollars and actions, without a bank login.

🎤 Rocket Money требует логин в банк и смотрит только транзакции. Trustworthy хранит документы, но не говорит, сколько вы потеряете. Мы — между ними.

---

## Slide 8 — Business model & unit economics
**Freemium → Pro $5/month or $49/year**
- Free: 5 files (documents + bank statement), money-at-risk score, subscription scan
- Pro: unlimited docs, ready emails & call scripts, calendar reminders, re-scan reminders

**Unit economics (*assumptions*)**
- Blended ARPU **$4.4/mo** (half pay annually)
- AI cost **< $0.10 per user/yr** (Gemini Flash-Lite, ~10 docs) · payments ~9% on $5 → gross margin **~88%**
- Avg paid lifetime **14 months** → **LTV ≈ $54**
- Blended **CAC ≈ $15** (organic content + SEO + referrals) → **LTV/CAC ≈ 3.6×**, payback **~4 months**

**Why users pay:** one avoided auto-renewal ($256) pays for 5 years of Pro.

🎤 Себестоимость почти нулевая, потому что AI дешёвый, а CSV анализируется в браузере. LTV больше CAC в 3,6 раза.

---

## Slide 9 — Go-to-market & why they come back
**Acquisition**
- Short videos "Adulting money traps" (TikTok, Reels, YouTube Shorts)
- SEO pages: "lease notice letter template", "how to cancel Audible", "FSA deadline Dec 31"
- Referral: "I protected $750 with DeadlineGuard" share card → 1 month Pro free
- Partnerships: renter communities, first-job onboarding newsletters

**Retention — why they return**
- Deadlines **recur**: rent, renewals, FSA every year, warranties, price hikes
- **Calendar reminders** bring users back before each deadline
- **Money protected** score and savings plan — visible progress
- Quarterly "re-scan your bank statement" reminder

🎤 Люди возвращаются, потому что дедлайны повторяются каждый год, а напоминания и прогресс «Money protected» возвращают их в продукт.

---

## Slide 10 — Roadmap & ask
**Now (MVP, live):** AI document analysis, CSV leak detector, dashboard, calendar, emails, .ics, Pro test mode
**Next 3 months:** Stripe payments · email/SMS reminders · optional encrypted account to sync devices · more document types (tax notices, car registration, student loans)
**6–12 months:** Gmail/receipt import (opt-in) · household sharing · cancellation concierge · Spanish version

**Ask:** feedback, pilot users (US renters 25–45), mentors in US consumer fintech.

**DeadlineGuard — never lose money on a missed deadline.**
deadlineguard-app.vercel.app

🎤 Сегодня работает MVP. Дальше — платежи, напоминания по email и SMS и необязательный аккаунт. Спасибо!

---

## Sources
1. EBRI via PSCA, Oct 2026 — 40% of FSA holders forfeited funds in 2024, avg $404: https://www.psca.org/news/psca-news/2026/10/fsa-contributions-rise-as-forfeitures-fall-ebri-finds/
2. C+R Research survey (2022) via CNBC — consumers underestimate subscriptions by $133/mo; 42% forgot a subscription: https://www.cnbc.com/2022/09/06/consumers-underestimate-monthly-subscription-costs-by-at-least-100.html
3. NCLC Issue Brief, June 2026 — ~$12.1B overdraft/NSF fees in 2024; CFPB rule repealed 2025: https://www.nclc.org/resources/overdraft-fees-rising-in-absence-of-cfpb-rule/
4. U.S. Census Bureau population estimates — ~90M adults aged 25–44 (approximate).
5. Rocket Money pricing & help center (2026): https://www.rocketmoney.com/learn/personal-finance/how-much-does-rocket-money-cost
6. Trustworthy pricing: https://www.trustworthy.com/pricing
