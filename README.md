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

## Defaults chosen

- Package manager pnpm; tests with Vitest; logging with pino; validation with zod.
- `IMAGE_MODE=hotlink` uses source image URLs directly; `placeholder` disables them.
