import * as cheerio from 'cheerio';

export type SitemapUrl = {
  loc: string;
  lastmod: string | null;
  imageUrl: string | null;
  imageCaption: string | null;
};

/** Sitemap index -> list of child sitemap URLs. */
export function parseSitemapIndex(xml: string): string[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $('sitemap > loc')
    .map((_, el) => $(el).text().trim())
    .get();
}

/** Monthly article sitemap -> entries (loc, lastmod, first image). */
export function parseArticleSitemap(xml: string): SitemapUrl[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $('url')
    .map((_, el) => {
      const url = $(el);
      const img = url.find('image\\:image').first();
      return {
        loc: url.children('loc').text().trim(),
        lastmod: url.children('lastmod').text().trim() || null,
        imageUrl: img.find('image\\:loc').text().trim() || null,
        imageCaption: img.find('image\\:caption').text().trim() || null,
      };
    })
    .get()
    .filter((u) => u.loc);
}

/** Pick monthly article sitemaps from the index, newest first, limited to `months` entries. */
export function pickArticleSitemaps(indexUrls: string[], months = 2): string[] {
  const parsed = indexUrls
    .map((url) => {
      const m = url.match(/sitemap-articles-(\d{1,2})-(\d{4})\.xml$/);
      return m ? { url, key: Number(m[2]) * 100 + Number(m[1]) } : null;
    })
    .filter((x): x is { url: string; key: number } => x !== null);
  return parsed
    .sort((a, b) => b.key - a.key)
    .slice(0, months)
    .map((x) => x.url);
}
