#!/usr/bin/env bash
# Seeds the e2e database and starts the API on :4010 (used by playwright.config.ts).
set -euo pipefail
cd "$(dirname "$0")/../../api"
export NODE_ENV=test MONGODB_URI=mongodb://localhost:27017/aimag_e2e API_PORT=4010 SCHEDULER_ENABLED=false
export CORS_ORIGINS=http://localhost:3110 WEB_URL=http://localhost:3110
# The e2e stack must never crawl the real source: point the scraper at a closed local port.
export TRUST_PROXY_HOPS=1 # the web server forwards the visitor's IP on login
export SCRAPER_BASE_URL=http://127.0.0.1:9 SCRAPER_MAX_RETRIES=0 SCHEDULER_RETRIES=0
export JWT_SECRET=e2e-jwt-secret-e2e-jwt-secret-1234 REVALIDATE_SECRET=e2e-revalidate-secret-e2e-1234567
node --import tsx src/db/seed-e2e.ts
exec node --import tsx src/server.ts
