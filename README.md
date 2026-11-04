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

## Quick start

### Run everything in Docker (production-like)

```bash
cp .env.example .env     # set JWT_SECRET, REVALIDATE_SECRET (32+ chars), SCRAPER_CONTACT_EMAIL; remove the COMPOSE_FILE line
docker compose up -d --build
docker compose exec api node dist/db/create-admin.js you@example.com 'a-long-password'
docker compose exec api node dist/scraper/run-cli.js --limit 20      # first articles (the 6-hourly schedule is already on)
open http://localhost:8080          # site;  /admin = admin panel
```

Services: `mongo`, `api` (Express + scraper + scheduler), `web` (Next.js), `nginx` (the only published port). To take it
live (domain, HTTPS, backups, Search Console): **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

### Develop locally

Requires Node >= 20, pnpm, Docker (for MongoDB only).

```bash
pnpm install
cp .env.example .env     # keeps COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml, which publishes Mongo on :27017
docker compose up -d mongo
pnpm --filter @aimag/shared build
pnpm --filter @aimag/api dev          # API + scheduler on :4000
pnpm --filter @aimag/web dev          # site on :3100
```

## Scripts

| Command                        | What it does                                                   |
| ------------------------------ | -------------------------------------------------------------- |
| `pnpm lint` / `pnpm format`    | ESLint / Prettier                                              |
| `pnpm typecheck` / `pnpm test` | Type-check / run tests in all packages                         |
| `pnpm scrape:once --limit 20`  | Scrape up to 20 new articles and print them (no DB)            |
| `./scripts/backup-mongo.sh`    | Compressed DB dump with rotation (`restore-mongo.sh` restores) |

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
  `/search` (noindex), `/about`, `/contact`, `/privacy`, `/terms`, `/dmca`, 404.
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

### Admin panel

`http://localhost:3100/admin`. Create the first account (a **super admin**) with
`pnpm --filter @aimag/api create-admin you@example.com 'a-long-password'`; add everyone else from **Users & roles**.

| Area          | What it does                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Dashboard     | KPIs, stories-per-day chart, scrape-run health strip, "attention needed" alerts                       |
| Articles      | Search/filter, **bulk** feature/hide/restore, takedown (with confirmation), per-article SEO overrides |
| Scrape runs   | History, errors, source-format warnings, **Run now**                                                  |
| Subscribers   | Search, delete, **CSV export** (formula-injection safe, audited)                                      |
| Ads           | AdSense or any network, 5 placements, consent, `ads.txt`, CSP hosts                                   |
| Site settings | Announcement bar, social links, GA4, feature toggles, footer note                                     |
| Users & roles | Create / change role / disable / unlock / reset password / delete; permission matrix                  |
| Audit log     | Who did what, when, from which IP (sign-ins, user and settings changes, exports, takedowns)           |
| My account    | Display name, change password (signs out other sessions)                                              |

**Roles (RBAC).** Permissions, not role names, are checked everywhere (`packages/shared/src/rbac.ts`); the API enforces them
and the UI only hides what you cannot use.

| Role        | Can do                                                          |
| ----------- | --------------------------------------------------------------- |
| Super admin | Everything, incl. managing other super admins                   |
| Admin       | Everything except managing super admins; can create lower roles |
| Editor      | Feature stories, edit SEO, view runs                            |
| Moderator   | Hide / restore / take down stories, view runs                   |
| Ad manager  | Dashboard + Ads                                                 |
| Viewer      | Read-only dashboard, articles, runs                             |

Rules: you can only create/edit accounts **below** your own role and hand out roles below yours; you cannot change your own
role or disable/delete yourself; a super admin always exists. Role, disable and password changes take effect on the user's
**very next request** (the token is checked against the database every time). 5 wrong passwords lock an account for
15 minutes (silently: same generic error, no account enumeration); an admin can unlock it. Everything is in the audit log.
Sign-in stores the JWT in an `httpOnly`, `SameSite=Strict` cookie scoped to `/admin` (12 h). Behind a reverse proxy, make it
set `X-Forwarded-For` to the real client IP so rate limits are per visitor.

### Ads, consent and analytics

Admin → **Ads**: turn ads on, choose **Google AdSense** (publisher ID `ca-pub-…` + ad-unit slot IDs) or **other network**
(paste its ad code), then enable the placements you want: header banner, in-feed (every N stories), sidebar, article top,
article bottom. Optional **Auto ads**. Other networks' domains go in "Allowed ad domains" and are added to the
Content-Security-Policy at request time; Google's are added automatically. `/ads.txt` is generated from your publisher ID and any extra lines.

- Ads and GA4 load **only after the visitor accepts** the cookie banner (default; "Ask for consent first"). Decline = no ad or
  analytics scripts at all; a footer "Cookie settings" link lets people change their mind. Ads never render in the admin.
- The built-in banner is basic. Google requires a **certified consent platform** for personalised ads to EU/UK/CH visitors:
  add one before targeting those regions, or leave AdSense on non-personalised ads in your AdSense account.
- You need your own AdSense account and an approved site: that is outside this repo.
- Ad slots render nothing on the server (cached pages never depend on consent) and appear after hydration, so the first
  paint has no ad space reserved. Pasted "other network" code runs in visitors' browsers: only use networks you trust
  (only users with the Ads permission can set it).

### Other site features

Dark mode (toggle in the header, saved in the browser, no flash), announcement bar (breaking/notice/info, optional expiry),
`/topics` index, an RSS feed **per category** (`/category/<slug>/feed.xml`), copy-link on articles, social links and footer
note, and a switch to hide the newsletter form. All are controlled from the admin without a redeploy.

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
- SIGINT/SIGTERM stops the cron, lets any running scrape (cron or admin button) finish its current page, records it as `partial`, releases the lock and exits.
- On startup, runs still marked `running` past the 30-minute lock lifetime (a crashed process) are closed out as `failed`.
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
