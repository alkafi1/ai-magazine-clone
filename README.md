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
apps/web       Next.js 16 frontend (App Router, Tailwind 4)
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

## Web app (Synthwire)

Brand: **Synthwire** — ink navy `#0c1222`, warm paper `#faf8f3`, violet `#5b3df5` accent, amber `#ffb703` highlight;
Fraunces (headlines) + Inter (text); own wire-pulse logo. Change the name in `apps/web/src/lib/site.ts`.

```bash
pnpm --filter @aimag/api dev        # API on :4000 (also runs the scheduler)
pnpm --filter @aimag/web dev        # site on :3100
pnpm --filter @aimag/web build && pnpm --filter @aimag/web start
```

- Pages: `/`, `/latest`, `/category/:slug`, `/tag/:slug`, `/author/:slug` (all paginated as `/page/2`), `/article/:slug`,
  `/search` (noindex), `/about`, `/contact`, `/privacy`, `/terms`, `/dmca`, 404. Admin comes in Phase 6.
- Rendering: ISR (`revalidate` 120s home, 300s elsewhere) plus on-demand `POST /api/revalidate` (secret header),
  called by the API after each scrape. Tags: `home`, `category:<slug>`, `article:<slug>`, `categories`, `latest`.
- SEO: `generateMetadata` on every page, canonical URLs, OG/Twitter tags with a generated branded card at
  `/og/<slug>` (we never re-share the source's picture), JSON-LD `Organization`, `WebSite`+`SearchAction`,
  `NewsArticle` (with `isBasedOn` = original URL) and `BreadcrumbList`, `/sitemap.xml` (index) ->
  `/sitemaps/pages.xml`, `/sitemaps/articles/N.xml` (1000 per file), `/news-sitemap.xml` (last 48h), `/robots.txt`,
  own RSS at `/feed.xml`.
- Removed/unknown stories render the 404 page (App Router pages cannot send 410; the API does return 410 and
  Nginx can map it in Phase 8).
- Client JS is limited to the newsletter form and a view beacon; the menu uses `<details>`.

### Images and Lighthouse (decision needed)

By default (`IMAGE_OPTIMIZE` unset) story pictures are **hotlinked** from the source CDN, using its small variants
(322px for cards, 668px for hero/article). The source serves PNGs, so heavy stories cost performance:
Lighthouse mobile in this mode scored 76-95 performance depending on the story (accessibility, best practices
and SEO are 98-100 everywhere). With `IMAGE_OPTIMIZE=true` (set at **build and run** time) Next resizes and converts
to WebP and caches those derivatives on our server: **home 94, article 99, category 96**. That means we store
resized copies of source images, so it is off until you decide it is acceptable.

## API

`pnpm --filter @aimag/api dev` serves on `API_PORT` (4000). Create the first admin with
`pnpm --filter @aimag/api create-admin you@example.com 'a-long-password'` (min 12 chars).

Public (cached 60-300s, `Cache-Control` set for CDN/Nginx): `GET /api/articles` (`category`, `tag`, `author`, `page`,
`limit`, `sort=latest|popular`), `/api/articles/:slug` (404 unknown, **410 taken down**), `/:slug/related`,
`POST /:slug/view`, `/api/home`, `/api/categories`, `/api/tags`, `/api/authors/:slug`, `/api/search?q=`,
`/api/trending`, `POST /api/newsletter` (5/hour/IP), `POST /api/revalidate` (header `x-revalidate-secret`).

Admin (`Authorization: Bearer <jwt>`, 12h): `POST /api/admin/login` (10 tries/15 min/IP), `GET|PATCH|DELETE
/api/admin/articles[/:id]`, `GET|POST /api/admin/scrape-runs`, `GET /api/admin/stats`. `DELETE` is a **takedown**
(hidden + 410), not a hard delete, so the scraper does not re-import the article. Changes are written to `AuditLog`.

Cross-cutting: zod validation on every input, helmet, CORS allowlist (`CORS_ORIGINS`), global rate limit
(300/min/IP), central JSON error handler, pino logs. The cache is in-memory per process and cleared on admin edits.

## Scheduler

`pnpm --filter @aimag/api dev` (or `start` after build) runs the API and the scheduler in one process.

- Cron `SCHEDULER_CRON` (default `0 */6 * * *`); disable with `SCHEDULER_ENABLED=false`.
- Overlap lock lives in MongoDB (`SiteSetting` key `lock:scrape`, 1h expiry), so a second trigger is skipped.
- A run with status `failed` is retried (`SCHEDULER_RETRIES`, doubling delay). A `blocked` run is never retried.
- On failure or block an alert is logged and POSTed to `ALERT_WEBHOOK_URL` (Slack/Discord-style `text` field).
- After a run that changed anything, the API calls `POST {WEB_URL}/api/revalidate` with header
  `x-revalidate-secret` (tags: `home`, `category:<slug>`, `article:<slug>`). Failures are only logged.
- SIGINT/SIGTERM stops the cron, lets the current page finish, marks the run partial and exits.
- Manual run: `POST /api/admin/scrape-runs` with an admin JWT (returns 202), or the admin panel button (Phase 6).
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
