export const CATEGORIES = [
  {
    id: "enterprise-ai",
    label: "Enterprise AI",
    dek: "Workplace tools, security, cloud, and B2B platforms.",
  },
  {
    id: "consumer-ai",
    label: "Consumer AI",
    dek: "Gadgets, apps, assistants, and products people actually use.",
  },
  {
    id: "industry-trends",
    label: "Industry Trends",
    dek: "Policy, research, labor, and how the field is shifting.",
  },
  {
    id: "ai-financials",
    label: "AI Financials",
    dek: "Funding, earnings, M&A, and the business of building models.",
  },
  {
    id: "tokenomics",
    label: "Tokenomics",
    dek: "API pricing, tokens, compute cost, and AI-crypto markets.",
  },
  {
    id: "misc",
    label: "Misc",
    dek: "Worth reading, but it does not sit cleanly on another desk.",
  },
];

export const SOURCES = [
  {
    name: "The Verge",
    home: "https://www.theverge.com/",
    feeds: [
      "https://www.theverge.com/rss/index.xml",
      "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    ],
  },
  {
    name: "TechCrunch",
    home: "https://techcrunch.com/",
    feeds: [
      "https://techcrunch.com/feed/",
      "https://techcrunch.com/category/artificial-intelligence/feed/",
    ],
  },
  {
    name: "Engadget",
    home: "https://www.engadget.com/",
    feeds: ["https://www.engadget.com/rss.xml"],
  },
  {
    name: "CNET",
    home: "https://www.cnet.com/",
    feeds: ["https://www.cnet.com/rss/news/"],
  },
  {
    name: "Ars Technica",
    home: "https://arstechnica.com/",
    feeds: ["https://feeds.arstechnica.com/arstechnica/index"],
  },
  {
    name: "Wired",
    home: "https://www.wired.com/",
    feeds: [
      "https://www.wired.com/feed/rss",
      "https://www.wired.com/feed/tag/ai/latest/rss",
    ],
  },
  {
    name: "The Register",
    home: "https://www.theregister.com/",
    feeds: ["https://www.theregister.com/headlines.atom"],
  },
  {
    name: "PCMag",
    home: "https://www.pcmag.com/",
    feeds: ["https://www.pcmag.com/feeds/rss/latest"],
  },
];

export const AI_PATTERN =
  /\b(ai|a\.i\.|agi|artificial intelligence|machine learning|deep learning|neural net|llm|large language model|foundation model|generative|genai|gpt|chatgpt|openai|anthropic|claude|gemini|copilot|midjourney|sora|grok|llama|mistral|deepseek|xai|inference|tokenomics?|tokens?\b|gpu cluster|nvidia|agentic|ai agent|multimodal)\b/i;

export const MAX_AGE_HOURS = 36;
export const MAX_STORIES = 24;
export const MAX_PER_CATEGORY = 5;
