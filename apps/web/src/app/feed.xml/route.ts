import { getFeed } from '@/lib/api';
import { SITE, abs } from '@/lib/site';
import { esc, xml } from '@/lib/xml';

export const revalidate = 300;

/** Our own RSS feed: headline + summary + link to our page. */
export async function GET() {
  const items = await getFeed().catch(() => []);
  const rows = items.map(
    (a) =>
      `<item><title>${esc(a.title)}</title><link>${esc(abs(`/article/${a.slug}`))}</link><guid isPermaLink="true">${esc(abs(`/article/${a.slug}`))}</guid><pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>${a.category ? `<category>${esc(a.category.name)}</category>` : ''}<description>${esc(a.excerpt)}</description></item>`,
  );
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(SITE.name)}</title><link>${SITE.url}</link><description>${esc(SITE.description)}</description><language>en</language><atom:link href="${abs('/feed.xml')}" rel="self" type="application/rss+xml"/>${rows.join('')}</channel></rss>`,
  );
}
