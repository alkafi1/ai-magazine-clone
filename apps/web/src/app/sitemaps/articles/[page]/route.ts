import { getSitemapArticles } from '@/lib/api';
import { abs } from '@/lib/site';
import { esc, xml } from '@/lib/xml';

export const revalidate = 300;

// URL looks like /sitemaps/articles/1.xml, so the segment is "1.xml".
export async function GET(_req: Request, { params }: { params: Promise<{ page: string }> }) {
  const m = (await params).page.match(/^(\d{1,4})\.xml$/);
  if (!m) return new Response('Not found', { status: 404 });
  const data = await getSitemapArticles(Number(m[1])).catch(() => null);
  if (!data) return new Response('Not found', { status: 404 });
  const rows = data.items.map(
    (a) =>
      `<url><loc>${esc(abs(`/article/${a.slug}`))}</loc><lastmod>${new Date(a.updatedAt).toISOString()}</lastmod></url>`,
  );
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join('')}</urlset>`,
  );
}
