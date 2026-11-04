import { getSitemapNews } from '@/lib/api';
import { SITE, abs } from '@/lib/site';
import { esc, xml } from '@/lib/xml';

export const revalidate = 300;

/** Google News sitemap: stories from the last 48 hours. */
export async function GET() {
  const items = await getSitemapNews().catch(() => []);
  const rows = items.map(
    (a) =>
      `<url><loc>${esc(abs(`/article/${a.slug}`))}</loc><news:news><news:publication><news:name>${esc(SITE.name)}</news:name><news:language>en</news:language></news:publication><news:publication_date>${new Date(a.publishedAt).toISOString()}</news:publication_date><news:title>${esc(a.title)}</news:title></news:news></url>`,
  );
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${rows.join('')}</urlset>`,
    200,
    120,
  );
}
