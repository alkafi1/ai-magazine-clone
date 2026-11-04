# Master prompt (paste this into Claude Code opened in this folder)

```
Read PLAN.md in this folder completely before doing anything. It is the single source of truth for scope, stack, database design, SEO plan, API design and phases. Follow it.

GOAL
Build a complete MERN-stack (Next.js App Router + TypeScript + Tailwind frontend, Node/Express + TypeScript API, MongoDB/Mongoose) AI news/magazine website. It has a similar structure to https://aimagazine.com but a completely original design and brand (own name, logo, palette, fonts). Content is aggregated from aimagazine.com by a scraper that runs automatically every 6 hours. SEO is a top priority.

HARD RULES (from PLAN.md section 1; never break them)
- Store/display only title, short excerpt (<= ~200 chars), thumbnail reference, category, author name, publish date and the canonical source URL. NEVER store or render full article bodies. Every article page links back to the original with clear attribution.
- Respect robots.txt in code: skip any URL containing "?" and the disallowed paths (/search, /company*, /executive*, /my-account, /thank-you, /_next, /sites/). Use a custom User-Agent, 1.5-2s delay, concurrency 1, exponential backoff, stop on repeated 403/429.
- Discover URLs via the monthly article sitemap (sitemap.xml -> sitemap-articles-<M>-<YYYY>.xml), parse each page via __NEXT_DATA__ JSON, falling back to JSON-LD, then meta tags. No headless browser unless proven necessary.
- Do not copy aimagazine.com's logo, brand name, CSS or exact layout pixels.
- All secrets in .env, never committed. Provide .env.example.

HOW TO WORK
1. Work phase by phase in the order of PLAN.md section 8. Before each phase, state the plan in a few lines; after each phase, run the tests/build/lint, fix failures, and commit with a clear conventional-commit message (no Co-Authored-By or "Generated with" lines). Git: init the repo if needed, work on a branch per phase or on main, your choice, but keep commits small.
2. Phase 1 (scraper prototype) is a GATE. Build it first, run it against the live site with a small limit (<= 20 articles), show me the sample output, and STOP to report if the site blocks us or the data is unusable. If it works, continue without asking.
3. Keep a progress checklist: tick the boxes in PLAN.md section 8 as tasks complete, and maintain a short CHANGELOG.md.
4. Write tests as you go: parser unit tests using saved HTML fixtures, API tests with Supertest, a few Playwright E2E tests for the main user flows.
5. Prefer simple, readable code over clever abstractions. Match the existing style once it is established. Validate all inputs with zod. Use pino for logging.
6. Do not ask me questions unless truly blocked; choose sensible defaults, note them in README.md, and move on. Exceptions where you must stop and ask: anything that costs money, needs my credentials/API keys, or publishes to the internet (deploy, DNS, Search Console).

DELIVERABLES (in this order)
- Phase 0: pnpm monorepo (apps/web, apps/api, packages/shared), TypeScript, ESLint, Prettier, Docker Compose for mongo + redis, config + logger, README.
- Phase 1: scraper CLI (`pnpm scrape:once --limit 20`) with robots checker, sitemap reader, fetcher, layered parser, normalizer, fixtures + tests.
- Phase 2: Mongoose models exactly as in the ER diagram and index table in PLAN.md section 4, upsert with dedup + sourceHash, ScrapeRun/ScrapeError logging, backfill command.
- Phase 3: scheduler (cron `0 */6 * * *`, overlap lock, graceful shutdown, retry, failure alert hook), manual trigger, call Next.js on-demand revalidation after each run.
- Phase 4: public + admin REST API per PLAN.md section 6, with caching, rate limiting, helmet, CORS allowlist, tests.
- Phase 5: Next.js frontend with ISR, original design, all pages in PLAN.md section 7, full SEO per section 5 (generateMetadata, canonical, OG/Twitter, JSON-LD NewsArticle/BreadcrumbList/Organization/WebSite, sitemap index + news sitemap, robots, own RSS feed), responsive and accessible, Lighthouse >= 90.
- Phase 6: admin panel (login, stats, article moderation, scrape runs, manual run).
- Phase 7: E2E tests, selector-break detection + alerting, security and performance pass.
- Phase 8: Dockerfiles, Nginx config, GitHub Actions CI, deployment docs, backup notes. Do NOT actually deploy or submit to Search Console; just prepare everything and tell me the exact steps.

DEFINITION OF DONE
- `docker compose up` brings the whole system up; a scrape run populates the DB; the site shows real articles with correct SEO tags; the 6-hour schedule is active; tests pass; README explains setup, env vars, how to run/trigger the scraper, and how to take the site live.

START NOW with Phase 0, then Phase 1, and stop at the Phase 1 gate to show me results.
```

## Tips for using it

- Open this folder in VS Code, start Claude Code, paste the block above.
- If a single session gets too long, tell it: "Continue from the next unchecked task in PLAN.md section 8". Progress is tracked by the checkboxes and git history.
- To go phase by phase instead of all at once, replace the last line with: "Do only Phase N and stop."
