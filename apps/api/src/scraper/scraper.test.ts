import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeExcerpt, normalizeArticle, slugify } from './normalizer.js';
import { parseArticleHtml } from './parser.js';
import { robotsFromText } from './robots.js';
import { parseArticleSitemap, parseSitemapIndex, pickArticleSitemaps } from './sitemap.js';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), 'utf8');

const URL_ = 'https://aimagazine.com/news/pif-aramco-humain-and-the-2-6bn-sovereign-ai-initiative';

describe('robots checker', () => {
  const robots = robotsFromText(fixture('robots.txt'));
  it('allows article pages', () => {
    expect(robots.isAllowed(URL_)).toBe(true);
    expect(robots.isAllowed('https://aimagazine.com/events/innovate-asia')).toBe(true);
  });
  it.each([
    'https://aimagazine.com/search',
    'https://aimagazine.com/company/humain',
    'https://aimagazine.com/companies/x',
    'https://aimagazine.com/executive/x',
    'https://aimagazine.com/executives/x',
    'https://aimagazine.com/my-account',
    'https://aimagazine.com/thank-you',
    'https://aimagazine.com/_next/data/x.json',
    'https://aimagazine.com/sites/default/x',
    'https://aimagazine.com/cdn-cgi/x',
    'https://aimagazine.com/news/foo?utm_source=x',
  ])('blocks %s', (url) => {
    expect(robots.isAllowed(url)).toBe(false);
  });
  it('blocks always-blocked paths even with an empty robots.txt', () => {
    expect(robotsFromText('').isAllowed('https://aimagazine.com/search')).toBe(false);
    expect(robotsFromText('').isAllowed(URL_)).toBe(true);
  });
});

describe('sitemap reader', () => {
  it('lists child sitemaps and picks the newest monthly article sitemaps', () => {
    const urls = parseSitemapIndex(fixture('sitemap-index.xml'));
    const picked = pickArticleSitemaps(urls, 2);
    expect(picked).toEqual([
      'https://aimagazine.com/sitemap-articles-11-2026.xml',
      'https://aimagazine.com/sitemap-articles-10-2026.xml',
    ]);
  });
  it('parses article entries with images', () => {
    const entries = parseArticleSitemap(fixture('sitemap-articles.xml'));
    expect(entries).toHaveLength(3);
    expect(entries[0]!.loc).toBe(URL_);
    expect(entries[0]!.imageUrl).toMatch(/^https:\/\/assets\.bizclikmedia\.net\//);
    expect(entries[0]!.imageCaption).toContain('Riyadh');
  });
});

describe('layered parser', () => {
  it('reads __NEXT_DATA__ first', () => {
    const raw = parseArticleHtml(fixture('article-next-data.html'))!;
    expect(raw.source).toBe('next-data');
    expect(raw.title).toBe('PIF & Aramco: HUMAIN and the $2.6bn Sovereign AI Initiative');
    expect(raw.authorName).toBe('Adam Pond');
    expect(raw.categoryName).toBe('AI Strategy');
    expect(raw.publishedAt).toBe('2026-11-02T09:27:50.755Z');
    expect(raw.imageUrl).toContain('assets.bizclikmedia.net/1200/');
  });
  it('falls back to JSON-LD', () => {
    const raw = parseArticleHtml(fixture('article-json-ld.html'))!;
    expect(raw.source).toBe('json-ld');
    expect(raw.title).toContain('HUMAIN');
    expect(raw.publishedAt).toBe('2026-11-02T09:27:50Z');
  });
  it('falls back to meta tags', () => {
    const raw = parseArticleHtml(fixture('article-meta-only.html'))!;
    expect(raw.source).toBe('meta');
    expect(raw.title).toContain('HUMAIN');
    expect(raw.authorName).toBe('Adam Pond');
    expect(raw.canonicalUrl).toBe(URL_);
  });
  it('returns null for unusable pages', () => {
    expect(parseArticleHtml(fixture('article-broken.html'))).toBeNull();
  });
});

describe('normalizer', () => {
  it('produces the stored shape without any body text', () => {
    const a = normalizeArticle(parseArticleHtml(fixture('article-next-data.html'))!, URL_)!;
    expect(a.slug).toBe('pif-and-aramco-humain-and-the-2-6bn-sovereign-ai-initiative');
    expect(a.sourceSlug).toBe('pif-aramco-humain-and-the-2-6bn-sovereign-ai-initiative');
    expect(a.category).toEqual({ name: 'AI Strategy', slug: 'ai-strategy' });
    expect(a.excerpt.length).toBeLessThanOrEqual(200);
    expect(a.sourceUrl).toBe(URL_);
    expect(a.sourceHash).toMatch(/^[0-9a-f]{32}$/);
    expect(Object.keys(a).sort()).toEqual(
      [
        'authorName',
        'category',
        'excerpt',
        'imageAlt',
        'imageUrl',
        'publishedAt',
        'slug',
        'sourceHash',
        'sourceModifiedAt',
        'sourceSlug',
        'sourceUrl',
        'title',
      ].sort(),
    );
  });
  it('hash is stable and changes with content', () => {
    const raw = parseArticleHtml(fixture('article-next-data.html'))!;
    const h1 = normalizeArticle(raw, URL_)!.sourceHash;
    expect(normalizeArticle(raw, URL_)!.sourceHash).toBe(h1);
    expect(normalizeArticle({ ...raw, title: 'Changed' }, URL_)!.sourceHash).not.toBe(h1);
  });
  it('rejects pages without title or date', () => {
    const raw = parseArticleHtml(fixture('article-next-data.html'))!;
    expect(normalizeArticle({ ...raw, publishedAt: null }, URL_)).toBeNull();
  });
  it('trims long excerpts at a word boundary to <= 200 chars', () => {
    const long = 'word '.repeat(100);
    const out = makeExcerpt(long);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith('…')).toBe(true);
    expect(makeExcerpt('<p>Hi &amp; bye</p>')).toBe('Hi & bye');
  });
  it('slugifies', () => {
    expect(slugify('Netflix’s AI Gone Wild: Why?')).toBe('netflix-s-ai-gone-wild-why');
  });
});
