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

export const abs = (path: string) => `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
