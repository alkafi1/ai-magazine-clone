# Taking Synthwire live

Everything below was exercised against the real Docker images in a throwaway project (build, `up`, scrape inside
the container, HTTPS via the TLS override with a self-signed certificate, backup and restore). **Nothing in this
repo deploys anything, touches DNS, or contacts Google for you.** Steps marked **YOU** need your accounts, money or
a decision.

---

## 0. Decide first (YOU)

| Question                                                                                                                                                                                                                                                               | Why it matters                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Permission from AI Magazine.** Email the publisher (BizClik) before launch: say what the site is, show them the excerpt-only design and the crawl policy, and ask whether they are comfortable (or would prefer a feed/partnership).                                 | The site's whole content is their reporting. Their robots.txt allows crawling, but robots.txt is not a licence. PLAN.md section 9 lists "copyright complaint" as the top risk. |
| **Name and trademark.** "Synthwire" was chosen for this project and has **not** been checked for availability or trademarks.                                                                                                                                           | Search for it before buying a domain. The name is one constant in `apps/web/src/lib/site.ts` (plus the logo SVG in `components/Logo.tsx` and `app/icon.svg`).                  |
| **A monitored contact address** (`SCRAPER_CONTACT_EMAIL`, `CONTACT_EMAIL`).                                                                                                                                                                                            | It appears in the crawler's User-Agent (so the publisher can reach you) and on the Contact and DMCA pages.                                                                     |
| **Image mode.** `IMAGE_OPTIMIZE=false` (default) hotlinks the source's images; `true` makes your server cache resized WebP copies (Lighthouse 94-99 instead of 76-95, see README).                                                                                     | A legal comfort decision as much as a performance one.                                                                                                                         |
| **Is this SEO-viable?** Search engines rank original content. A site of headlines + 200-character summaries risks being treated as thin/duplicate content. The original value you can add (curation, categories, your own commentary) is what makes it worth indexing. | Set expectations before spending on hosting.                                                                                                                                   |

Costs: a server (about 2 vCPU / 2-4 GB RAM / 20 GB disk is enough), a domain, and optionally an uptime monitor or
error tracker. Nothing in the app calls a paid API.

## 1. Server (YOU)

1. Create an Ubuntu 22.04/24.04 server. Open only ports **22, 80, 443** (cloud firewall and `ufw`).
2. Install Docker Engine with the Compose plugin (<https://docs.docker.com/engine/install/ubuntu/>), then:
   `sudo usermod -aG docker $USER` and log in again.
3. Install certbot: `sudo apt install -y certbot`.

## 2. Domain (YOU)

Create DNS records pointing your domain at the server: `A` (and `AAAA` if you have IPv6) for `example.com` **and**
`www.example.com`. Wait until `dig +short example.com` returns the server IP before step 5.

## 3. Get the code and configure

```bash
sudo mkdir -p /opt/synthwire && sudo chown $USER /opt/synthwire
git clone <your-repo-url> /opt/synthwire && cd /opt/synthwire
cp .env.example .env
```

Edit `.env`. These are the values the stack needs (the rest have safe defaults):

| Variable                                 | Set to                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`, `REVALIDATE_SECRET`        | two different random strings, 32+ chars: `openssl rand -base64 48 \| tr -d '\n=/+' \| head -c 48`. **The API refuses to start with short or default values.** |
| `SITE_URL`                               | `https://example.com` (no trailing slash)                                                                                                                     |
| `CONTACT_EMAIL`, `SCRAPER_CONTACT_EMAIL` | your monitored address                                                                                                                                        |
| `ALERT_WEBHOOK_URL`                      | optional Slack/Discord/other webhook that receives failure and "source format changed" alerts                                                                 |
| `IMAGE_OPTIMIZE`                         | `false` or `true` (step 0)                                                                                                                                    |

Remove the line `COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml` if present (it publishes MongoDB to the
host and is only for development). `.env` is git-ignored and must never be committed.

## 4. First start over HTTP

```bash
docker compose up -d --build        # first build takes several minutes
docker compose ps                   # mongo, api, web: healthy; nginx: up
curl -I http://localhost:8080/about # 200
```

MongoDB is **not** published to the host. The site listens on `HTTP_PORT` (default 8080).

## 5. HTTPS (YOU: needs DNS from step 2)

1. Get the certificate. Port 80 is free at this point (the stack is on 8080):

   ```bash
   sudo certbot certonly --standalone -d example.com -d www.example.com \
        --agree-tos -m you@example.com --no-eff-email
   ```

2. In `.env` set:

   ```
   SITE_URL=https://example.com
   DOMAIN=example.com
   COMPOSE_FILE=docker-compose.yml:docker-compose.tls.yml
   HTTP_PORT=80
   HTTPS_PORT=443
   ```

3. Rebuild and restart. **`--build` is required**: `SITE_URL` is baked into the web bundle (canonical URLs, social
   cards, sitemap URLs, CSP).

   ```bash
   docker compose up -d --build
   curl -I https://example.com/about    # 200, strict-transport-security, content-security-policy
   curl -I http://example.com/about     # 301 to https
   ```

4. Renewal. certbot renews only when a certificate is within 30 days of expiry, and the hooks run only then
   (brief nginx restart). Add to root's crontab (`sudo crontab -e`):

   ```
   17 4 * * 1 certbot renew --quiet --pre-hook "cd /opt/synthwire && docker compose stop nginx" --post-hook "cd /opt/synthwire && docker compose start nginx"
   ```

   Test it once with `sudo certbot renew --dry-run`.

## 6. Create the admin user and the first content

```bash
# 12+ character password; this makes a SUPER ADMIN and is the login for https://example.com/admin.
# Create everyone else (editors, moderators, ad managers...) from the admin: Users & roles.
docker compose exec api node dist/db/create-admin.js you@example.com 'a-long-unique-password'

# Backfill. ~1.75 s per article by design (polite crawling): 400 articles take about 12 minutes.
docker compose exec api node dist/scraper/run-cli.js --since 2026-10
```

The scheduler is already running (`SCHEDULER_CRON`, default `0 */6 * * *`) and fetches new stories every 6 hours.
Pages refresh immediately after scheduled and admin-triggered runs. After a CLI backfill, the site shows the new
stories within ~2 minutes (ISR), or sign in to `/admin/scrape-runs` and press **Run now**.

## 7. Verify before announcing

```bash
curl -s https://example.com/robots.txt            # Disallow /admin, /api/, /search + Sitemap line
curl -s https://example.com/sitemap.xml           # index -> pages, news, articles/1.xml
curl -s https://example.com/feed.xml | head       # RSS
curl -sI https://example.com/article/<a-slug>     # 200, canonical in the HTML
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://example.com/api/revalidate   # 404 (internal only)
```

- Sign in at `/admin`; the Scrape runs page should show a `success` run. A **warning** under a run means the source
  site's format changed; read it.
- (YOU) Run <https://pagespeed.web.dev/> and Google's Rich Results Test
  (<https://search.google.com/test/rich-results>) on a few article URLs.
- Ask a friend to try a taken-down story: hide an article in the admin, then `curl -I` its URL: **410**.

## 7b. Ads and analytics (YOU, optional)

1. Create an AdSense account and get the site approved (<https://adsense.google.com>); this needs real content and a live
   domain, so do it after launch. Create ad units and note the **publisher ID** (`ca-pub-…`) and each unit's **slot ID**.
2. Sign in at `/admin` -> **Ads**: turn ads on, paste the publisher ID, enable placements and fill in their slot IDs, save.
   `https://example.com/ads.txt` is generated for you (check it). Keep "Ask for consent first" on.
3. If you target the EU/UK/Switzerland, add a **Google-certified consent management platform**: the built-in cookie banner
   is basic and does not satisfy Google's requirements for personalised ads there.
4. Analytics: `/admin` -> **Site settings** -> GA4 measurement ID (`G-…`). It loads only after consent.
5. Update your Privacy page to name the ad network and analytics you actually use.

## 8. Search engines (YOU)

The app deliberately does none of this for you.

1. Google Search Console (<https://search.google.com/search-console>): add a **Domain** property, verify with the DNS
   TXT record it gives you, then **Sitemaps -> add `https://example.com/sitemap.xml`**.
2. Bing Webmaster Tools: import from Search Console, or add the site and submit the same sitemap.
3. The `/news-sitemap.xml` is included for completeness, but Google News inclusion requires its own application
   (Publisher Center) and is aimed at original reporting. Do not expect it to be accepted for an aggregator.
4. Give indexing weeks, not hours. Watch the "Pages" and "Crawl stats" reports for errors.

## 9. Monitoring (YOU choose the services)

- **Uptime:** point any uptime monitor at `https://example.com/` (keyword check on "Synthwire") and
  `https://example.com/api/articles?limit=1`. The API's `/health` is intentionally not exposed publicly.
- **Scrape health:** set `ALERT_WEBHOOK_URL`. You will be messaged when a run fails or is blocked, and when the source
  site's format looks changed (selector-break detection). Also check `/admin/scrape-runs` weekly.
- **Errors:** no error tracker (Sentry etc.) is wired in because it needs your account and DSN. Logs are structured
  JSON: `docker compose logs -f api web`. Docker log files rotate (10 MB x 3 per service).
- **Disk and memory:** `docker stats`, `df -h`. MongoDB data lives in the `mongo-data` volume.

## 10. Backups

```bash
cd /opt/synthwire
./scripts/backup-mongo.sh                       # -> backups/aimag-YYYYMMDD-HHMMSS.archive.gz, keeps the newest 14
crontab -e   # daily at 03:15:
15 3 * * * cd /opt/synthwire && ./scripts/backup-mongo.sh >> backups/backup.log 2>&1
```

- **Copy backups off the server** (the same disk is not a backup): e.g. `rclone` to object storage, or `scp` from
  another machine. Which provider is your choice (YOU).
- **Restore** (destructive, asks you to type `restore`):
  `./scripts/restore-mongo.sh backups/aimag-....archive.gz && docker compose restart api`
- The data is re-creatable (it is mirrored from the source), so the irreplaceable parts are the admin accounts,
  newsletter subscribers, your SEO overrides, hidden/featured flags and view counts. **Test a restore once** on a
  spare machine.
- Managed alternative: MongoDB Atlas (point `MONGODB_URI` at it in `docker-compose.yml`, drop the `mongo` service).
  Atlas has its own automated backups.

## 11. Updating and rolling back

```bash
cd /opt/synthwire
git pull
docker compose up -d --build          # rebuilds changed images; indexes are created automatically at API start
docker compose ps
```

Roll back with `git checkout <previous-tag-or-commit> && docker compose up -d --build`. There are no schema
migrations; Mongoose creates new indexes on start. Take a backup before upgrading.

## 12. Troubleshooting

| Symptom                                                                   | Check                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api` exits at start: "must be a random string of at least 32 characters" | `JWT_SECRET` / `REVALIDATE_SECRET` are short or still `change-me...`.                                                                                                                           |
| Run warning "sitemap index lists no monthly article sitemaps"             | The source's sitemap index is missing the article sitemaps (seen on 2026-11-04). The scraper falls back to computed month URLs, then to the homepage list. Informational unless runs also fail. |
| Run `failed`: "discovery found no article URLs"                           | Source changed layout or is down. See the run's error and warnings; the alert webhook fires. Re-run with **Run now**.                                                                           |
| Run `blocked`                                                             | The source returned 403/429 three times in a row; the scraper stops on purpose. Wait, lower frequency (`SCHEDULER_CRON`), and contact the publisher.                                            |
| Home page says "Fresh headlines are on the way"                           | No articles yet (run the backfill), or the first build-time render is cached; it refreshes within 2 minutes.                                                                                    |
| Admin login gives "Too many attempts"                                     | 10 tries per 15 minutes per IP (plus an nginx limit). Wait, or restart `api` to clear the in-memory counter.                                                                                    |
| Everyone shares one rate-limit bucket                                     | The API sees nginx's address instead of the visitor's: check `TRUST_PROXY_HOPS` (compose sets 1) and that nothing else sits in front of nginx.                                                  |
| MongoDB container restarts or segfaults                                   | Seen on one development machine with a very new kernel under heavy index builds. Use a stock Ubuntu LTS kernel, or MongoDB Atlas.                                                               |
| `docker build` of `web` dies with `kill EACCES`                           | Old Docker builder; the Dockerfile already sets `NEXT_BUILD_THREADS=1` to avoid it.                                                                                                             |

## 13. Go-live checklist

- [ ] Permission/contact with the publisher sent; trademark and domain checked
- [ ] `.env` has strong unique secrets and a real, monitored contact email; `.env` is not in git
- [ ] `docker compose ps` all healthy; HTTPS works; HTTP redirects; `www` redirects
- [ ] Admin created; default/dev credentials do not exist on this server
- [ ] First backfill done; scheduled run succeeded once (`/admin/scrape-runs`)
- [ ] `/api/revalidate` returns 404 from the internet; MongoDB port is not reachable from outside (`nmap` or cloud firewall)
- [ ] Backups scheduled **and** copied off-server **and** a restore tested
- [ ] Uptime monitor and alert webhook configured
- [ ] Sitemap submitted in Search Console and Bing
- [ ] Privacy, Terms, DMCA pages reviewed by you (they are sensible defaults, not legal advice)
