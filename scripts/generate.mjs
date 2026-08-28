import crypto from "node:crypto";
import Parser from "rss-parser";
import {
  AI_PATTERN,
  CATEGORIES,
  MAX_AGE_HOURS,
  MAX_PER_CATEGORY,
  MAX_STORIES,
  SOURCES,
} from "./sources.mjs";
import { enrichStories, stripHtml } from "./summarize.mjs";
import { writeSite } from "./render.mjs";

const FEED_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; AINewsBrief/1.0; +https://github.com/colinpjack/AINewsBrief)",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
};

const parser = new Parser({
  timeout: 15000,
  headers: FEED_HEADERS,
  customFields: {
    item: [["source", "origin"]],
  },
});

function hashId(url) {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 12);
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAiStory(title, content, categories = []) {
  const hay = `${title}\n${content}\n${categories.join(" ")}`;
  return AI_PATTERN.test(hay);
}

function storyDate(item) {
  const raw = item.isoDate || item.pubDate || item.published;
  const d = raw ? new Date(raw) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function fetchFeed(url) {
  try {
    const res = await fetch(url, {
      headers: FEED_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Status code ${res.status}`);
    const xml = await res.text();
    const feed = await parser.parseString(xml);
    const sourceUrls = [...xml.matchAll(/<source\s+url="([^"]+)"/gi)].map((m) => m[1]);
    if (feed.items && sourceUrls.length === feed.items.length) {
      feed.items.forEach((item, i) => {
        item.originUrl = sourceUrls[i];
      });
    }
    return feed;
  } catch (err) {
    console.warn(`Feed failed ${url}: ${err.message}`);
    return null;
  }
}

function titleTokens(title) {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((w) => w.length > 3 && !["with", "from", "that", "this", "have", "been", "will", "into", "over"].includes(w)),
  );
}

function similarTitles(a, b) {
  const A = titleTokens(a);
  const B = titleTokens(b);
  if (A.size < 3 || B.size < 3) return false;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter >= 4 && inter / Math.min(A.size, B.size) >= 0.45;
}

function clusterStories(stories) {
  const kept = [];
  for (const story of stories) {
    const twin = kept.find((other) => similarTitles(other.title, story.title));
    if (!twin) {
      kept.push(story);
      continue;
    }
    const longer = stripHtml(story.content).length > stripHtml(twin.content).length ? story : twin;
    const other = longer === story ? twin : story;
    const idx = kept.indexOf(twin);
    kept[idx] = {
      ...longer,
      alsoFrom: [...new Set([...(twin.alsoFrom || []), other.source])].filter(
        (name) => name !== longer.source,
      ),
    };
  }
  return kept;
}

function cleanCopy(text) {
  return String(text)
    .replace(/\s*…?\s*Read the full story at [^.]+/gi, "")
    .replace(/\s+Additional reporting from the source:.*$/s, "")
    .trim();
}

function originUrl(item) {
  if (item.originUrl) return item.originUrl;
  const origin = item.origin;
  if (!origin) return "";
  if (typeof origin === "string") return "";
  return origin?.$?.url || origin?.url || "";
}

function unwrapItem(item) {
  let url = (item.link || item.guid || "").trim();
  let title = (item.title || "").trim();
  const original = originUrl(item);
  if (original && /news\.google\.com/i.test(url)) url = original;
  title = title
    .replace(/\s+-\s+PCMag(?:\s+[A-Za-z]+)*$/i, "")
    .replace(/\s+-\s+CNET$/i, "")
    .trim();
  return { url, title };
}

function isHubPage(title) {
  return /^(all about ai|artificial intelligence)$/i.test(title.trim());
}

function pickContent(item) {
  return (
    item["content:encoded"] ||
    item.content ||
    item.summary ||
    item.contentSnippet ||
    item.description ||
    ""
  );
}

export async function collectStories() {
  const cutoff = Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000;
  const seenUrls = new Set();
  const seenTitles = new Set();
  const collected = [];
  const jobs = SOURCES.flatMap((source) =>
    source.feeds.map(async (feedUrl) => ({ source, feed: await fetchFeed(feedUrl) })),
  );
  const results = await Promise.all(jobs);

  for (const { source, feed } of results) {
    if (!feed?.items) continue;
    for (const item of feed.items) {
      const { url, title } = unwrapItem(item);
      if (!url || !title || isHubPage(title) || seenUrls.has(url)) continue;
      if (/news\.google\.com/i.test(url)) continue;
      const published = storyDate(item);
      if (published.getTime() < cutoff) continue;
      const content = pickContent(item);
      const cats = (item.categories || []).map(String);
      if (!isAiStory(title, stripHtml(content), cats)) continue;
      const key = normalizeTitle(title);
      if (seenTitles.has(key)) continue;
      seenUrls.add(url);
      seenTitles.add(key);
      collected.push({
        id: hashId(url),
        title,
        url,
        source: source.name,
        sourceHome: source.home,
        publishedAt: published.toISOString(),
        content,
      });
    }
  }

  collected.sort((a, b) => {
    const recency = new Date(b.publishedAt) - new Date(a.publishedAt);
    if (Math.abs(recency) > 8 * 60 * 60 * 1000) return recency;
    return stripHtml(b.content).length - stripHtml(a.content).length;
  });
  return clusterStories(collected).slice(0, MAX_STORIES * 2);
}

function capCategories(stories) {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  const picked = [];
  for (const story of stories) {
    const cat = story.category || "misc";
    if ((counts[cat] || 0) >= MAX_PER_CATEGORY) continue;
    counts[cat] = (counts[cat] || 0) + 1;
    picked.push(story);
    if (picked.length >= MAX_STORIES) break;
  }
  return picked;
}

async function main() {
  console.log("Collecting feeds…");
  const raw = await collectStories();
  console.log(`AI stories in window: ${raw.length}`);
  const enriched = (await enrichStories(raw)).map((story) => ({
    ...story,
    summary: cleanCopy(story.summary),
    expanded: cleanCopy(story.expanded) || cleanCopy(story.summary),
  }));
  const stories = capCategories(enriched).map(({ content, alsoFrom, ...rest }) => ({
    ...rest,
    ...(alsoFrom?.length ? { alsoFrom } : {}),
  }));
  const generatedAt = new Date().toISOString();
  const brief = {
    generatedAt,
    date: new Intl.DateTimeFormat("en-CA", {
      timeZone: process.env.TZ || "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    timezone: process.env.TZ || "America/New_York",
    storyCount: stories.length,
    sources: SOURCES.map((s) => s.name),
    summarizer: stories[0]?.summarizer || "extractive",
    stories,
  };
  writeSite(brief);
  console.log(`Wrote ${stories.length} stories for ${brief.date} (${brief.summarizer})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
