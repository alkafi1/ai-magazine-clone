import { SITE, abs } from './site';
import type { Article } from './types';
import { esc, xml } from './xml';

/** RSS 2.0 for a list of stories: headline + our summary + a link to OUR page (never the full text). */
export function rssResponse(opts: {
  title: string;
  description: string;
  selfPath: string;
  linkPath: string;
  items: Article[];
}) {
  const rows = opts.items.map(
    (a) =>
      `<item><title>${esc(a.title)}</title><link>${esc(abs(`/article/${a.slug}`))}</link><guid isPermaLink="true">${esc(abs(`/article/${a.slug}`))}</guid><pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>${a.category ? `<category>${esc(a.category.name)}</category>` : ''}<description>${esc(a.excerpt)}</description></item>`,
  );
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(opts.title)}</title><link>${esc(abs(opts.linkPath))}</link><description>${esc(opts.description)}</description><language>en</language><atom:link href="${esc(abs(opts.selfPath))}" rel="self" type="application/rss+xml"/>${rows.join('')}</channel></rss>`,
  );
}
void SITE;
