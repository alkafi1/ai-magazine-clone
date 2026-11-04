#!/usr/bin/env bash
# Waits for the e2e API, then builds and serves the production web app on :3110 (separate dist dir).
set -euo pipefail
cd "$(dirname "$0")/.."
export API_URL=http://localhost:4010 NEXT_PUBLIC_API_URL=http://localhost:4010 NEXT_PUBLIC_SITE_URL=http://localhost:3110
export REVALIDATE_SECRET=e2e-revalidate-secret-e2e-1234567 NEXT_DIST_DIR=.next-e2e
for _ in $(seq 1 60); do curl -sf http://localhost:4010/health >/dev/null && break; sleep 1; done
node node_modules/next/dist/bin/next build
exec node node_modules/next/dist/bin/next start -p 3110
