import fs from "node:fs";

function loadDotEnv() {
  try {
    const path = new URL("../.env", import.meta.url);
    const text = fs.readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // no local .env
  }
}

loadDotEnv();

const VALID = new Set([
  "enterprise-ai",
  "consumer-ai",
  "industry-trends",
  "ai-financials",
  "tokenomics",
  "misc",
]);

const CATEGORY_HINTS = [
  {
    id: "tokenomics",
    pattern:
      /\b(tokenomics|token price|tokens per|api pricing|price per token|context window|inference cost|compute cost|gpu rental|h100|b200|cryptocurrenc|crypto token|on-chain|stablecoin)\b/i,
  },
  {
    id: "ai-financials",
    pattern:
      /\b(raised|funded|funding|series [a-f]\b|valuation|ipo|earnings|revenue|profit|acquisition|acquires|merger|stock|shares|market cap|venture|\bvc\b|investment)\b/i,
  },
  {
    id: "enterprise-ai",
    pattern:
      /\b(enterprise|workplace|saas|b2b|copilot for|microsoft 365|salesforce|servicenow|cybersecurity|\bcyber\b|cloud|aws|azure|gcp|slack|teams|compliance|audit)\b/i,
  },
  {
    id: "consumer-ai",
    pattern:
      /\b(iphone|android|gadget|headphones|laptop|smartphone|chatgpt app|consumer|review|wearable|smart home|camera|tablet|gaming)\b/i,
  },
  {
    id: "industry-trends",
    pattern:
      /\b(regulat|policy|congress|eu ai act|copyright|labor|jobs|union|research|paper|study|safety|alignment|open source|culture|lawsuit|court|judge|ruling)\b/i,
  },
];

export function guessCategory(title, text) {
  const haystack = `${title}\n${text}`;
  for (const hint of CATEGORY_HINTS) {
    if (hint.pattern.test(haystack)) return hint.id;
  }
  return "misc";
}

export function stripHtml(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
  return parts.map((s) => s.trim()).filter((s) => s.length > 20);
}

function paragraphize(parts, size = 3) {
  const chunks = [];
  for (let i = 0; i < parts.length; i += size) {
    chunks.push(parts.slice(i, i + size).join(" "));
  }
  return chunks;
}

export function extractiveSummary(title, rawText) {
  const text = stripHtml(rawText);
  const bits = sentences(text);
  const usable = bits.length ? bits : [text || title];
  const summary = usable.slice(0, 3).join(" ");
  const expanded = paragraphize(usable.slice(0, 9), 3).slice(0, 3).join("\n\n");
  return {
    summary: summary.slice(0, 700),
    expanded: expanded.slice(0, 1800),
  };
}

function provider() {
  if (process.env.OPENAI_API_KEY) {
    return {
      name: "openai",
      url: `${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
      key: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      name: "anthropic",
      url: "https://api.anthropic.com/v1/messages",
      key: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    };
  }
  return null;
}

const SYSTEM = `You are the night editor for a daily AI news briefing.
Rewrite reporting into clear morning-brief copy. Do not invent facts.
Return ONLY a JSON object: {"stories":[...]} where each element is:
{
  "id": string,
  "headline": string,
  "summary": string,
  "expanded": string,
  "category": "enterprise-ai" | "consumer-ai" | "industry-trends" | "ai-financials" | "tokenomics" | "misc"
}
Rules:
- headline: keep the original sense; tighten if it is clickbait.
- summary: one paragraph, 70-110 words, what happened and why it matters.
- expanded: 2-3 short paragraphs separated by \\n\\n, using only the source text.
- category:
  enterprise-ai = workplace, B2B, security, cloud, copilots at work
  consumer-ai = gadgets, consumer apps, devices, everyday products
  industry-trends = policy, research, culture, labor, regulation
  ai-financials = funding, earnings, M&A, stocks, revenue
  tokenomics = API/token pricing, compute cost, AI-related crypto/tokens
  misc = AI-related but none of the above`;

async function chatOpenAI(p, user) {
  const body = {
    model: p.model,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  };
  if (p.name === "openai") body.response_format = { type: "json_object" };

  const res = await fetch(p.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${p.name} ${res.status}: ${err.slice(0, 400)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function chatAnthropic(p, user) {
  const res = await fetch(p.url, {
    method: "POST",
    headers: {
      "x-api-key": p.key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: 4000,
      temperature: 0.3,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`anthropic ${res.status}: ${err.slice(0, 400)}`);
  }
  const data = await res.json();
  return data.content?.map((b) => b.text).join("\n") || "";
}

function parseJsonPayload(text) {
  const trimmed = text.trim();
  const block = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = block ? block[1] : trimmed;
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.stories)) return parsed.stories;
  if (Array.isArray(parsed.items)) return parsed.items;
  return [parsed];
}

export async function enrichStories(stories) {
  const fallback = stories.map((story) => {
    const copy = extractiveSummary(story.title, story.content);
    return {
      ...story,
      headline: story.title,
      summary: copy.summary,
      expanded: copy.expanded,
      category: guessCategory(story.title, story.content),
      summarizer: "extractive",
    };
  });

  const p = provider();
  if (!p || stories.length === 0) return fallback;

  const batches = [];
  for (let i = 0; i < stories.length; i += 6) {
    batches.push(stories.slice(i, i + 6));
  }

  const enriched = [];
  for (const batch of batches) {
    const payload = batch.map((s) => ({
      id: s.id,
      title: s.title,
      source: s.source,
      url: s.url,
      text: stripHtml(s.content).slice(0, 4000),
    }));
    const user = `Edit these ${payload.length} stories:\n${JSON.stringify(payload)}`;
    try {
      const content =
        p.name === "anthropic" ? await chatAnthropic(p, user) : await chatOpenAI(p, user);
      const items = parseJsonPayload(content);
      const byId = new Map(items.map((item) => [item.id, item]));
      for (const story of batch) {
        const item = byId.get(story.id);
        const base = fallback.find((f) => f.id === story.id);
        if (!item?.summary) {
          enriched.push(base);
          continue;
        }
        enriched.push({
          ...story,
          headline: item.headline || story.title,
          summary: String(item.summary).trim(),
          expanded: String(item.expanded || item.summary).trim(),
          category: VALID.has(item.category)
            ? item.category
            : guessCategory(story.title, story.content),
          summarizer: p.name,
        });
      }
    } catch (err) {
      console.warn(`LLM batch failed (${p.name}): ${err.message}`);
      for (const story of batch) {
        enriched.push(fallback.find((f) => f.id === story.id));
      }
    }
  }
  return enriched;
}
