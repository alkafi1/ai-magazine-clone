import { getSitemapArticles } from '@/lib/api';
import { abs } from '@/lib/site';
import { xml } from '@/lib/xml';

export const revalidate = 300;

export async function GET() {
  const first = await getSitemapArticles(1).catch(() => null);
  const count = first?.pageCount ?? 1;
  const urls = [
    abs('/sitemaps/pages.xml'),
    abs('/news-sitemap.xml'),
    ...Array.from({ length: count }, (_, i) => abs(`/sitemaps/articles/${i + 1}.xml`)),
  ];
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join('')}</sitemapindex>`,
  );
}
