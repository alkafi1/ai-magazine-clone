# AI Magazine Clone

An AI news site (Next.js + Express + MongoDB) with its own design and brand. Headlines are aggregated
from [aimagazine.com](https://aimagazine.com) by a polite scraper that runs every 6 hours.
See [PLAN.md](PLAN.md) for scope, database design, SEO and API plans.

## Content rules (never broken)

- Only title, short excerpt (<= 200 chars), thumbnail URL, category, author name, publish date and the
  canonical source URL are stored. **Full article bodies are never stored or shown.**
- robots.txt is enforced in code before every fetch (no `?` URLs, no disallowed paths).
- Crawl: custom User-Agent, 1.5-2s delay, concurrency 1, exponential backoff, stop on repeated 403/429.

## Layout

```
apps/api       Express API, scraper, scheduler
apps/web       Next.js frontend (Phase 5)
packages/shared  zod schemas and types shared by both
```

## Setup

Requires Node >= 20, pnpm, Docker.

```bash
pnpm install
cp .env.example .env        # set SCRAPER_CONTACT_EMAIL to a real address
docker compose up -d        # mongo + redis
pnpm --filter @aimag/shared build
```

## Scripts

| Command                        | What it does                                        |
| ------------------------------ | --------------------------------------------------- |
| `pnpm lint` / `pnpm format`    | ESLint / Prettier                                   |
| `pnpm typecheck` / `pnpm test` | Type-check / run tests in all packages              |
| `pnpm scrape:once --limit 20`  | Scrape up to 20 new articles and print them (no DB) |

## Environment variables

See [.env.example](.env.example); all are validated with zod in `apps/api/src/config`.

## Scheduler

`pnpm --filter @aimag/api dev` (or `start` after build) runs the API and the scheduler in one process.

- Cron `SCHEDULER_CRON` (default `0 */6 * * *`); disable with `SCHEDULER_ENABLED=false`.
- Overlap lock lives in MongoDB (`SiteSetting` key `lock:scrape`, 1h expiry), so a second trigger is skipped.
- A run with status `failed` is retried (`SCHEDULER_RETRIES`, doubling delay). A `blocked` run is never retried.
- On failure or block an alert is logged and POSTed to `ALERT_WEBHOOK_URL` (Slack/Discord-style `text` field).
- After a run that changed anything, the API calls `POST {WEB_URL}/api/revalidate` with header
  `x-revalidate-secret` (tags: `home`, `category:<slug>`, `article:<slug>`). Failures are only logged.
- SIGINT/SIGTERM stops the cron, lets the current page finish, marks the run partial and exits.
- Manual run: `curl -X POST -H "x-internal-secret: $REVALIDATE_SECRET" localhost:4000/api/internal/scrape-runs`
  (returns 202; Phase 4 adds the JWT-protected admin equivalent).
- The web app defaults to port 3100 because 3000 is commonly taken.

## Data model notes

- Upsert key is `sourceUrl`; an article is only rewritten when `sourceHash` changes. Admin-controlled fields
  (`isFeatured`, `isHidden`, `seo`, `slug`) are never overwritten by the scraper.
- Only the sections in `SCRAPER_SECTIONS` (default `news,articles`) are imported; the source sitemap also
  lists `/events/` and `/press-releases/` pages, which are excluded.
- Source pages expose no modified date, and the sitemap has no `lastmod`, so a known URL is not re-fetched.
- Tests in `src/db` need MongoDB (`docker compose up -d mongo`); they use the `aimag_test` database
  (override with `MONGODB_URI_TEST`).
- The compose mongo service runs as the `mongodb` user: the default entrypoint's `gosu` step hung on this host.

## Defaults chosen

- Package manager pnpm; tests with Vitest; logging with pino; validation with zod.
- `IMAGE_MODE=hotlink` uses source image URLs directly; `placeholder` disables them.
