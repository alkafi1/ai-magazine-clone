import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BlockedError, FetchError, type PoliteFetcher } from './fetcher.js';
import { discoverEntries, monthlySitemapUrls, parseHomepageLatest } from './run.js';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), 'utf8');
const B = 'https://aimagazine.com';
const NOW = new Date('2026-11-04T10:00:00Z');
const monthXml = fixture('sitemap-articles.xml');
const homepage = (paths: string[]) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { latestArticles: paths.map((p) => ({ headline: 'h', fullUrlPath: p })) } },
  })}</script></html>`;
const indexXml = (locs: string[]) =>
  `<sitemapindex>${locs.map((l) => `<sitemap><loc>${l}</loc></sitemap>`).join('')}</sitemapindex>`;

/** Stub fetcher: serves `pages`, answers 404 for everything else; records what was requested. */
function stub(pages: Record<string, string | Error>) {
  const requested: string[] = [];
  const f = {
    isAllowed: () => true,
    get: async (url: string) => {
      requested.push(url);
      const page = pages[url];
      if (page instanceof Error) throw page;
      if (page === undefined) throw new FetchError(`HTTP 404 for ${url}`, 404);
      return page;
    },
  };
  return { fetcher: f as unknown as PoliteFetcher, requested };
}

describe('monthlySitemapUrls', () => {
  it('counts back across a year boundary, without leading zeros', () => {
    expect(monthlySitemapUrls(new Date('2027-01-15T00:00:00Z'), 3, B)).toEqual([
      `${B}/sitemap-articles-1-2027.xml`,
      `${B}/sitemap-articles-12-2026.xml`,
      `${B}/sitemap-articles-11-2026.xml`,
    ]);
  });
});

describe('discoverEntries', () => {
  it('survives an index with no article sitemaps and a 404 for the current month (the live failure on 2026-11-04)', async () => {
    const { fetcher } = stub({
      [`${B}/sitemap.xml`]: indexXml([
        `${B}/sitemap-authors.xml`,
        `${B}/sitemap-image-robotics.xml`,
      ]),
      [`${B}/sitemap-articles-10-2026.xml`]: monthXml,
    });
    const { entries, warnings } = await discoverEntries(fetcher, { months: 2 }, NOW);
    expect(entries.length).toBe(2); // the fixture’s 3rd URL is in an excluded section
    expect(warnings.join(' ')).toMatch(/lists no monthly article sitemaps/);
  });

  it('merges index-listed and computed months without duplicates, newest first', async () => {
    const { fetcher, requested } = stub({
      [`${B}/sitemap.xml`]: indexXml([
        `${B}/sitemap-articles-10-2026.xml`,
        `${B}/sitemap-articles-11-2026.xml`,
      ]),
      [`${B}/sitemap-articles-11-2026.xml`]: monthXml,
      [`${B}/sitemap-articles-10-2026.xml`]: monthXml,
    });
    const { entries, warnings } = await discoverEntries(fetcher, { months: 2 }, NOW);
    expect(entries.length).toBe(2); // the fixture’s 3rd URL is in an excluded section // same URLs in both months are de-duplicated
    expect(warnings).toEqual([]);
    expect(requested.filter((u) => u.includes('sitemap-articles'))).toEqual([
      `${B}/sitemap-articles-11-2026.xml`,
      `${B}/sitemap-articles-10-2026.xml`,
    ]);
  });

  it('falls back to the homepage list when no sitemap yields URLs', async () => {
    const { fetcher } = stub({
      [`${B}/sitemap.xml`]: indexXml([]),
      [`${B}/`]: homepage([
        '/news/a',
        '/articles/b',
        '/events/not-an-article',
        'javascript:alert(1)',
      ]),
    });
    const { entries, warnings } = await discoverEntries(fetcher, { months: 2 }, NOW);
    expect(entries.map((e) => e.loc)).toEqual([`${B}/news/a`, `${B}/articles/b`]); // events section excluded
    expect(warnings.join(' ')).toMatch(/fell back to the homepage/);
  });

  it('returns nothing (with reasons) when everything fails, so the caller can fail the run', async () => {
    const { fetcher } = stub({
      [`${B}/sitemap.xml`]: new FetchError('HTTP 500', 500),
      [`${B}/`]: new FetchError('HTTP 500', 500),
    });
    const { entries, warnings } = await discoverEntries(fetcher, { months: 2 }, NOW);
    expect(entries).toEqual([]);
    expect(warnings.join(' ')).toMatch(/index unavailable/);
    expect(warnings.join(' ')).toMatch(/homepage fallback failed/);
  });

  it('never swallows a block (403/429 stop)', async () => {
    const { fetcher } = stub({
      [`${B}/sitemap.xml`]: new BlockedError('blocked (429) 3 times in a row'),
    });
    await expect(discoverEntries(fetcher, { months: 2 }, NOW)).rejects.toBeInstanceOf(BlockedError);
  });

  it('backfill reads every month since the start, oldest first', async () => {
    const { fetcher, requested } = stub({ [`${B}/sitemap.xml`]: indexXml([]) });
    await discoverEntries(fetcher, { since: '2026-09' }, NOW);
    expect(requested.filter((u) => u.includes('sitemap-articles'))).toEqual([
      `${B}/sitemap-articles-9-2026.xml`,
      `${B}/sitemap-articles-10-2026.xml`,
      `${B}/sitemap-articles-11-2026.xml`,
    ]);
  });
});

describe('parseHomepageLatest', () => {
  it('ignores malformed data', () => {
    expect(parseHomepageLatest('<html></html>', B)).toEqual([]);
    expect(parseHomepageLatest('<script id="__NEXT_DATA__">{bad</script>', B)).toEqual([]);
  });
});
