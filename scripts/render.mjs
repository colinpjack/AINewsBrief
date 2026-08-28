import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, SOURCES } from "./sources.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const ARCHIVE_DIR = path.join(DOCS, "archive");
const DATA_DIR = path.join(DOCS, "data");

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatLongDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(iso, timeZone) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

function paragraphs(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
}

function listArchiveDates(currentDate) {
  const dates = new Set([currentDate]);
  if (fs.existsSync(DATA_DIR)) {
    for (const file of fs.readdirSync(DATA_DIR)) {
      const match = file.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (match) dates.add(match[1]);
    }
  }
  return [...dates].sort().reverse();
}

function renderStory(story, timeZone) {
  const compact = story.summary.replace(/\s+/g, "");
  const long = story.expanded.replace(/\s+/g, "");
  const more = long.length > compact.length + 40
    ? `<details>
    <summary><span class="more">More</span><span class="less">Less</span></summary>
    <div class="expanded">${paragraphs(story.expanded)}</div>
  </details>`
    : "";
  const also = story.alsoFrom?.length
    ? ` · also ${escapeHtml(story.alsoFrom.join(", "))}`
    : "";
  return `<article class="story" id="story-${escapeHtml(story.id)}" data-category="${escapeHtml(story.category)}">
  <p class="kicker"><span>${escapeHtml(story.source)}${also}</span><time datetime="${escapeHtml(story.publishedAt)}">${escapeHtml(formatTime(story.publishedAt, timeZone))}</time></p>
  <h3>${escapeHtml(story.headline)}</h3>
  <div class="lede">${paragraphs(story.summary)}</div>
  ${more}
  <p class="source-link"><a href="${escapeHtml(story.url)}" rel="noopener noreferrer">Read at ${escapeHtml(story.source)}</a></p>
</article>`;
}

function renderSections(brief) {
  return CATEGORIES.map((cat) => {
    const stories = brief.stories.filter((s) => s.category === cat.id);
    if (!stories.length) return "";
    return `<section class="desk" id="${cat.id}">
  <header class="desk-head">
    <h2>${escapeHtml(cat.label)}</h2>
    <p>${escapeHtml(cat.dek)}</p>
  </header>
  <div class="story-list">
    ${stories.map((s) => renderStory(s, brief.timezone)).join("\n")}
  </div>
</section>`;
  }).join("\n");
}

function navLinks(brief) {
  return CATEGORIES.filter((cat) => brief.stories.some((s) => s.category === cat.id))
    .map((cat) => `<a href="#${cat.id}">${escapeHtml(cat.label)}</a>`)
    .join("");
}

function archiveOptions(dates, current) {
  return dates
    .map(
      (d) =>
        `<option value="${d}"${d === current ? " selected" : ""}>${escapeHtml(formatLongDate(d))}</option>`,
    )
    .join("");
}

function pageShell({ title, description, bodyClass, assetPrefix = "", content }) {
  const css = `${assetPrefix}assets/brief.css`;
  const js = `${assetPrefix}assets/brief.js`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect fill='%23161412' width='64' height='64' rx='10'/><text x='32' y='42' text-anchor='middle' font-size='22' fill='%23f6f1e7' font-family='Georgia,serif'>AI</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${css}">
</head>
<body class="${bodyClass}">
  ${content}
  <script src="${js}"></script>
</body>
</html>
`;
}

function masthead(brief, dates, isArchiveEdition) {
  const homeHref = isArchiveEdition ? "../index.html" : "index.html";
  const archiveHref = isArchiveEdition ? "index.html" : "archive/index.html";
  return `<header class="masthead">
  <div class="masthead-top">
    <p class="edition">${escapeHtml(formatLongDate(brief.date))}</p>
    <div class="tools">
      <label class="edition-picker">Edition
        <select data-edition>${archiveOptions(dates, brief.date)}</select>
      </label>
      <a class="theme-toggle" href="${archiveHref}">Archive</a>
      <button type="button" class="theme-toggle" data-theme-toggle aria-label="Toggle color theme">Theme</button>
    </div>
  </div>
  <a class="mark" href="${homeHref}">
    <span class="mark-box">AI</span>
    <span>
      <strong>News Brief</strong>
      <em>A morning desk for artificial intelligence</em>
    </span>
  </a>
  <p class="census">${brief.storyCount} ${brief.storyCount === 1 ? "story" : "stories"} · ${SOURCES.length} sources · ${escapeHtml(brief.summarizer === "extractive" ? "desk edit from source text" : `edited with ${brief.summarizer}`)}</p>
  <nav class="desks" aria-label="Desks">${navLinks(brief)}</nav>
</header>`;
}

function footer() {
  const sources = SOURCES.map(
    (s) => `<a href="${escapeHtml(s.home)}" rel="noopener noreferrer">${escapeHtml(s.name)}</a>`,
  ).join(" · ");
  return `<footer class="colophon">
  <p>Compiled from ${sources}.</p>
  <p>Headlines and summaries are generated for private morning reading. Always open the source for the full report.</p>
</footer>`;
}

export function renderBriefPage(brief, dates, { isArchiveEdition = false } = {}) {
  const empty = brief.stories.length === 0
    ? `<section class="empty"><h2>No AI stories in this window</h2><p>The next scheduled run will try again. You can also trigger the GitHub Action manually.</p></section>`
    : "";
  const content = `${masthead(brief, dates, isArchiveEdition)}
<main>
  ${empty}
  ${renderSections(brief)}
</main>
${footer()}`;
  return pageShell({
    title: `AI News Brief — ${formatLongDate(brief.date)}`,
    description: `Daily AI briefing for ${formatLongDate(brief.date)}, gathered from major tech and news desks.`,
    bodyClass: isArchiveEdition ? "archive-edition" : "today",
    assetPrefix: isArchiveEdition ? "../" : "",
    content,
  });
}

export function renderArchiveIndex(dates) {
  const items = dates
    .map(
      (d) =>
        `<li><a href="${d}.html"><span>${escapeHtml(formatLongDate(d))}</span><span class="arrow">Read</span></a></li>`,
    )
    .join("");
  const content = `<header class="masthead">
  <p class="edition">Past editions</p>
  <a class="mark" href="../index.html">
    <span class="mark-box">AI</span>
    <span>
      <strong>News Brief</strong>
      <em>Archive</em>
    </span>
  </a>
</header>
<main>
  <section class="archive-list">
    <h2>Editions</h2>
    <ul>${items || "<li>No editions yet.</li>"}</ul>
  </section>
</main>
${footer()}`;
  return pageShell({
    title: "Archive — AI News Brief",
    description: "Past daily AI briefings.",
    bodyClass: "archive-page",
    assetPrefix: "../",
    content,
  });
}

export function writeSite(brief) {
  fs.mkdirSync(path.join(DOCS, "assets"), { recursive: true });
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DOCS, ".nojekyll"), "");

  const dates = listArchiveDates(brief.date);
  fs.writeFileSync(
    path.join(DATA_DIR, "latest.json"),
    JSON.stringify(brief, null, 2),
  );
  fs.writeFileSync(
    path.join(DATA_DIR, `${brief.date}.json`),
    JSON.stringify(brief, null, 2),
  );
  fs.writeFileSync(
    path.join(DATA_DIR, "index.json"),
    JSON.stringify({ dates }, null, 2),
  );

  fs.writeFileSync(path.join(DOCS, "index.html"), renderBriefPage(brief, dates));
  fs.writeFileSync(
    path.join(ARCHIVE_DIR, `${brief.date}.html`),
    renderBriefPage(brief, dates, { isArchiveEdition: true }),
  );
  fs.writeFileSync(path.join(ARCHIVE_DIR, "index.html"), renderArchiveIndex(dates));
}
