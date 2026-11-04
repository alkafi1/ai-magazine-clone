# Changelog

## Unreleased

- Admin v2: RBAC (6 roles, 14 permissions), user management, audit log, lockout, bulk actions; ads (AdSense/custom) with consent, GA4, announcement bar, dark mode, topics, per-category RSS, ads.txt; dynamic CSP; site-wide quality crawl (a11y + links); fixes: server-to-server rate-limit exemption, dark-mode contrast, keyboard-accessible tables.
- Phase 8: Dockerfiles (API, web), full `docker compose up` stack with nginx, TLS override, CI workflow, backup/restore scripts, deployment guide; resilient discovery (computed month URLs + homepage fallback, zero-URL runs fail); true HTTP 410 for taken-down stories.
- Phase 7: security hardening, selector-break detection (run warnings + alert), query-plan review with 3 new indexes.
- Fix: manual runs now honour graceful shutdown; stale `running` runs are recovered at startup.
- Phase 6: admin panel (login via httpOnly cookie, dashboard, article moderation + SEO overrides + takedown, scrape runs, manual run).
- Phase 5: Next.js frontend (Synthwire brand), ISR + on-demand revalidation, full SEO (metadata, JSON-LD, sitemaps, news sitemap, robots, RSS, OG cards), thumbnails, optional image optimizer.
- Phase 4: public + admin REST API (zod, helmet, CORS allowlist, rate limits, cache, JWT admin, takedown flow) with Supertest tests.
- Phase 3: cron scheduler (6h), Mongo overlap lock, retry + alert webhook, graceful shutdown, manual trigger, Next.js revalidation call.
- Phase 2: Mongoose models + indexes, article upsert with dedup/sourceHash, ScrapeRun/ScrapeError logging, category seed, `scrape` and `backfill` commands.
- Phase 1: scraper prototype (robots checker, sitemap reader, polite fetcher, layered parser, normalizer, CLI, fixtures + tests). Live run: 20/20 articles parsed.
- Phase 0: monorepo, tooling, Docker Compose (mongo, redis), config and logger.
