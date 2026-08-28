# AI News Brief

A daily morning briefing on artificial intelligence, compiled from The Verge, TechCrunch, Engadget, CNET, Ars Technica, Wired, The Register, and PCMag. Stories are grouped into Enterprise AI, Consumer AI, Industry Trends, AI Financials, Tokenomics, and Misc. Each item has a headline, a one-paragraph summary, a **More** control that expands to two or three paragraphs, and a link back to the source.

The site is static and meant to be hosted on GitHub Pages. A GitHub Action rebuilds the briefing every day at 10:00 UTC (6:00 AM Eastern).

## Read it

After the repository is on GitHub and Pages is enabled, the briefing lives at:

`https://<your-github-username>.github.io/AINewsBrief/`

## How it is built

`scripts/generate.mjs` pulls RSS/Atom feeds from the eight desks, keeps AI-related items from the last 36 hours, de-duplicates them, and writes:

- `docs/index.html` — today's briefing
- `docs/archive/YYYY-MM-DD.html` — that day's edition
- `docs/data/latest.json` — machine-readable copy

If an `OPENAI_API_KEY`, `GROQ_API_KEY`, or `ANTHROPIC_API_KEY` is present, the generator asks the model to write the summary, expanded copy, and category. Without a key it still publishes, using extractive summaries from the feed text.

PCMag's own RSS feed is often behind a bot challenge. The generator still requests it each morning, so stories appear when the feed is reachable. The other seven desks are enough to fill the briefing if PCMag is blocked.

## Run locally

```bash
cp .env.example .env   # optional: add an API key
npm install
npm run generate
npm run preview        # http://localhost:4173
```

## GitHub Pages

1. Push this repository to GitHub (public, so Pages can serve it).
2. Settings → Pages → Build and deployment → Source: **Deploy from a branch**.
3. Branch: `main`, folder: `/docs`.
4. Optional: Settings → Secrets and variables → Actions, add `OPENAI_API_KEY` (or `GROQ_API_KEY` / `ANTHROPIC_API_KEY`) for rewritten copy.
5. Actions → Daily brief → **Run workflow** to generate the first live edition, or wait for the 10:00 UTC schedule.

The Action commits updated files under `docs/` back to `main`. GitHub Pages then serves that folder.

## Categories

| Desk | What lands there |
| --- | --- |
| Enterprise AI | Workplace tools, security, cloud, B2B platforms |
| Consumer AI | Gadgets, apps, assistants, household tech |
| Industry Trends | Policy, research, labor, culture |
| AI Financials | Funding, earnings, M&A, the business of models |
| Tokenomics | API/token pricing, compute cost, AI-related crypto |
| Misc | AI stories that do not sit cleanly on another desk |
