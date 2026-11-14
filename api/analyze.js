// DeadlineGuard — AI document analyzer (Vercel serverless function, no dependencies)
// Set ONE of these environment variables in Vercel → Project → Settings → Environment Variables:
//   ANTHROPIC_API_KEY   (optional: ANTHROPIC_MODEL, default "claude-sonnet-5-5")
//   GEMINI_API_KEY      (free tier; optional: GEMINI_MODEL, default "gemini-3.5-flash-lite")
//   OPENAI_API_KEY      (optional: OPENAI_MODEL, default "gpt-4.1-mini")
// The uploaded file is sent to the AI provider for analysis and is NOT stored anywhere.

const PROMPT = (today) => `You are DeadlineGuard, an assistant that protects young US adults from losing money on "adulting" paperwork.
Today's date is ${today}.

Read the attached document (insurance policy, warranty/receipt, lease, tax notice, FSA/HSA statement, ID document, subscription email, bill, etc.).
Find every DATE that can cost the user money if missed (renewals, auto-renewals, expirations, payment due dates, notice deadlines, use-it-or-lose-it deadlines, price increases).

Return ONLY valid JSON, no markdown, with exactly this shape:
{
  "doc_type": "auto_insurance | home_insurance | renters_insurance | health_insurance | warranty | lease | tax | fsa_hsa | subscription | id_document | bill | other",
  "title": "short human title, e.g. 'Auto insurance — Brightline'",
  "provider": "company name or null",
  "summary": "one plain-English sentence explaining what this document means for the user's money",
  "items": [
    {
      "label": "short name of the deadline, e.g. 'Policy auto-renews at higher price'",
      "date": "YYYY-MM-DD",
      "type": "renewal | expiration | payment_due | notice_deadline | use_or_lose | price_increase | other",
      "amount": number or null,
      "money_at_risk": number,
      "risk_level": "high | medium | low",
      "why": "one or two sentences: what happens if the user misses this, and how money_at_risk was estimated",
      "action": "the single most useful thing to do, starting with a verb",
      "act_by": "YYYY-MM-DD (recommended date to act, usually before the deadline)",
      "draft_email": { "to": "who to send to (company/department)", "subject": "...", "body": "polite, ready-to-send email written in first person, with [placeholders] for personal details" } or null
    }
  ],
  "hidden_costs": ["short bullet about any fee, penalty, auto-renewal or price increase hidden in the fine print"]
}

Rules:
- Use only dates that appear in the document or follow directly from it (e.g. "60 days before lease end"). Never invent dates.
- money_at_risk is a realistic US-dollar estimate of what the user loses if they do nothing (e.g. premium increase, forfeited balance, penalty, out-of-warranty repair cost). Use 0 if nothing is at risk. Explain the basis in "why".
- Never double count: if two items describe the same risk (e.g. "warranty ends" and "last day to buy extended protection"), put the money at risk on ONE item and use 0 on the other. The price of an optional product the user could buy is NOT money at risk.
- Write for a busy 28-year-old, plain English, no jargon.
- If the document is not a personal finance/admin document, return doc_type "other" and an empty items array.`;

function cleanJson(text) {
  if (!text) throw new Error("Empty AI response");
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("AI did not return JSON");
  return JSON.parse(t.slice(first, last + 1));
}

async function callAnthropic({ data, mediaType, text, fileName, today }) {
  const content = [];
  if (text) {
    content.push({ type: "text", text: `Document "${fileName}":\n\n${text}` });
  } else if (mediaType === "application/pdf") {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
  } else {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data } });
  }
  content.push({ type: "text", text: PROMPT(today) });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 2500,
      messages: [{ role: "user", content }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `Anthropic error ${r.status}`);
  const out = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return cleanJson(out);
}

// Google Gemini — has a free tier (key from aistudio.google.com, no card needed)
async function callGemini({ data, mediaType, text, fileName, today }) {
  const parts = [];
  if (text) parts.push({ text: `Document "${fileName}":\n\n${text}` });
  else parts.push({ inline_data: { mime_type: mediaType, data } });
  parts.push({ text: PROMPT(today) });

  const models = [process.env.GEMINI_MODEL || "gemini-3.5-flash-lite", "gemini-2.5-flash-lite"];
  // Free tier sometimes answers 503 "high demand" / 429: retry once, then try the next model
  const attempts = [];
  for (const m of [...new Set(models)]) attempts.push(m, m);
  let lastErr;
  for (let a = 0; a < attempts.length; a++) {
    const model = attempts[a];
    if (a % 2 === 1) await new Promise((res) => setTimeout(res, 1200));
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const out = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      return cleanJson(out);
    }
    lastErr = new Error(j?.error?.message || `Gemini error ${r.status}`);
    if (r.status === 404) { a += a % 2 === 0 ? 1 : 0; continue; } // model doesn't exist: skip its retry
    if (![429, 500, 503].includes(r.status)) break; // bad key / bad request: retrying won't help
  }
  throw lastErr;
}

async function callOpenAI({ data, mediaType, text, fileName, today }) {
  const content = [];
  if (text) {
    content.push({ type: "text", text: `Document "${fileName}":\n\n${text}` });
  } else if (mediaType === "application/pdf") {
    content.push({ type: "file", file: { filename: fileName || "document.pdf", file_data: `data:application/pdf;base64,${data}` } });
  } else {
    content.push({ type: "image_url", image_url: { url: `data:${mediaType};base64,${data}` } });
  }
  content.push({ type: "text", text: PROMPT(today) });

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `OpenAI error ${r.status}`);
  return cleanJson(j.choices?.[0]?.message?.content);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "Use POST" }));
  }
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    const { data, mediaType, text, fileName } = body || {};
    if (!data && !text) throw new Error("No file received");

    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!text && !allowed.includes(mediaType)) throw new Error(`Unsupported file type: ${mediaType}. Use PDF, PNG, JPG or TXT.`);

    const today = new Date().toISOString().slice(0, 10);
    const args = { data, mediaType, text, fileName, today };

    let result;
    if (process.env.ANTHROPIC_API_KEY) result = await callAnthropic(args);
    else if (process.env.GEMINI_API_KEY) result = await callGemini(args);
    else if (process.env.OPENAI_API_KEY) result = await callOpenAI(args);
    else throw new Error("No AI key configured. Add ANTHROPIC_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY in your Vercel environment variables.");

    if (!Array.isArray(result.items)) result.items = [];
    if (!Array.isArray(result.hidden_costs)) result.hidden_costs = [];
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(result));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: e.message || String(e) }));
  }
};
