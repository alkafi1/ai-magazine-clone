export const SITE = {
  name: 'Synthwire',
  tagline: 'The wire for artificial intelligence news',
  description:
    'Synthwire curates the day’s most important AI headlines — models, chips, startups, policy and people — and points you to the original reporting.',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100').replace(/\/$/, ''),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'editor@example.com',
  sourceName: 'AI Magazine',
  sourceUrl: 'https://aimagazine.com',
} as const;

/** Returns the URL only if it is plain https; anything else (javascript:, data:, ...) becomes null. */
export function safeHttpsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** For <img src>: https anywhere; plain http only for local development (e.g. the dev API's uploads). */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return url;
    // http is only tolerated for localhost (a local test stack serving its own uploads); it can only
    // work on the visitor's own machine, so it is harmless in production.
    if (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)) return url;
  } catch {
    /* not a URL */
  }
  return null;
}

export const abs = (path: string) => `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
