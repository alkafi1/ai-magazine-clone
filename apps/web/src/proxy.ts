import { NextResponse, type NextRequest } from 'next/server';

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').origin;
const SLUG = /^\/article\/([a-z0-9-]{1,120})$/;
const isProd = process.env.NODE_ENV === 'production';

// ---- Content-Security-Policy ----------------------------------------------------------------
// Base policy is strict; hosts for ads / analytics are added only when the admin has turned them on.
type SiteCfg = {
  ads: { enabled: boolean; provider: 'adsense' | 'custom'; scriptHosts: string[] };
  ga4Id: string;
};
let cached: { at: number; cfg: SiteCfg } | null = null;

async function siteCfg(): Promise<SiteCfg | null> {
  if (cached && Date.now() - cached.at < 10_000) return cached.cfg;
  try {
    const res = await fetch(`${API}/api/site-config`, {
      headers: { 'x-internal-secret': process.env.REVALIDATE_SECRET ?? '' },
      signal: AbortSignal.timeout(800),
    });
    if (res.ok) {
      cached = { at: Date.now(), cfg: (await res.json()) as SiteCfg };
      return cached.cfg;
    }
  } catch {
    // API slow or down: keep the last known policy, else the strict base
  }
  return cached?.cfg ?? null;
}

const GOOGLE_ADS_SCRIPT = [
  'https://pagead2.googlesyndication.com',
  'https://*.googlesyndication.com',
  'https://*.google.com',
  'https://*.googleadservices.com',
  'https://*.doubleclick.net',
  'https://*.adtrafficquality.google',
  'https://www.googletagservices.com',
  'https://fundingchoicesmessages.google.com',
];

async function contentSecurityPolicy(): Promise<string> {
  const cfg = await siteCfg();
  const script = ["'self'", "'unsafe-inline'"];
  const connect = ["'self'", API_ORIGIN];
  // our own uploads (logo, covers) are served by the API
  const img = ["'self'", 'data:', 'https://assets.bizclikmedia.net', API_ORIGIN];
  const frame: string[] = [];
  if (cfg?.ads.enabled) {
    if (cfg.ads.provider === 'adsense') {
      script.push(...GOOGLE_ADS_SCRIPT);
      connect.push(...GOOGLE_ADS_SCRIPT);
      frame.push(...GOOGLE_ADS_SCRIPT);
      img.push('https:'); // ad creatives come from many hosts
    }
    for (const host of cfg.ads.scriptHosts) {
      script.push(host);
      connect.push(host);
      frame.push(host);
      img.push(host);
    }
  }
  if (cfg?.ga4Id) {
    script.push('https://www.googletagmanager.com');
    connect.push(
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
      'https://*.googletagmanager.com',
    );
    img.push('https://*.google-analytics.com', 'https://*.googletagmanager.com');
  }
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img.join(' ')}`,
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    `frame-src ${frame.length ? frame.join(' ') : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * 1. /admin/*: optimistic gate. No cookie, no admin pages (the API still verifies the token on every call).
 * 2. /article/<slug>: if the API says the story was taken down (410), answer 410 instead of a plain 404,
 *    so search engines remove it. Fails open: if the API is slow or down, the page renders as normal.
 * 3. Production: attach the Content-Security-Policy (depends on the admin ad/analytics settings).
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  let res = NextResponse.next();

  if (pathname.startsWith('/admin')) {
    if (pathname !== '/admin/login' && !req.cookies.get('admin_token')) {
      res = NextResponse.redirect(new URL('/admin/login', req.url));
    }
  } else {
    const slug = SLUG.exec(pathname)?.[1];
    if (slug) {
      try {
        const r = await fetch(`${API}/api/articles/${slug}`, {
          method: 'HEAD',
          headers: { 'x-internal-secret': process.env.REVALIDATE_SECRET ?? '' },
          signal: AbortSignal.timeout(1500),
        });
        if (r.status === 410)
          res = NextResponse.rewrite(new URL('/gone', req.url), { status: 410 });
      } catch {
        // fail open
      }
    }
  }

  if (isProd) res.headers.set('Content-Security-Policy', await contentSecurityPolicy());
  return res;
}

// Pages only: skip static assets, generated images and machine-readable files.
export const config = {
  matcher: [
    '/((?!_next/|api/|og/|favicon|icon\\.svg|robots\\.txt|sitemap|sitemaps/|news-sitemap|feed\\.xml|ads\\.txt).*)',
  ],
};
