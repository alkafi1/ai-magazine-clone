import { getSitemapPages } from '@/lib/api';
import { abs } from '@/lib/site';
import { esc, xml } from '@/lib/xml';

export const revalidate = 300;
const BUILTIN = new Set(['about', 'contact', 'privacy', 'terms', 'dmca']);

export async function GET() {
  const data = await getSitemapPages().catch(() => null);
  const paths = [
    '/',
    '/latest',
    '/topics',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/dmca',
    ...(data?.categories ?? []).map((s) => `/category/${s}`),
    ...(data?.tags ?? []).map((s) => `/tag/${s}`),
    ...(data?.authors ?? []).map((s) => `/author/${s}`),
    ...(data?.pages ?? []).map((s) => (BUILTIN.has(s) ? `/${s}` : `/p/${s}`)),
  ];
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${esc(abs(p))}</loc></url>`).join('')}</urlset>`,
  );
}
