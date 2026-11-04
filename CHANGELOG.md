# Changelog

## Unreleased

- Phase 4: public + admin REST API (zod, helmet, CORS allowlist, rate limits, cache, JWT admin, takedown flow) with Supertest tests.
- Phase 3: cron scheduler (6h), Mongo overlap lock, retry + alert webhook, graceful shutdown, manual trigger, Next.js revalidation call.
- Phase 2: Mongoose models + indexes, article upsert with dedup/sourceHash, ScrapeRun/ScrapeError logging, category seed, `scrape` and `backfill` commands.
- Phase 1: scraper prototype (robots checker, sitemap reader, polite fetcher, layered parser, normalizer, CLI, fixtures + tests). Live run: 20/20 articles parsed.
- Phase 0: monorepo, tooling, Docker Compose (mongo, redis), config and logger.
