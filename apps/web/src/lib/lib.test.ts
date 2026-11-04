import { describe, expect, it } from 'vitest';
import { pagePath, parsePage } from './format';
import { breadcrumbLd, newsArticleLd, websiteLd } from './jsonld';
import { esc } from './xml';
import type { Article } from './types';

const branding = {
  name: 'Test Site',
  tagline: 't',
  description: 'd',
  logoUrl: '',
  logoDarkUrl: '',
  faviconUrl: '',
  showName: true,
  contactEmail: '',
};
const article: Article = {
  id: '1',
  kind: 'scraped',
  title: 'A Headline',
  slug: 'a-headline',
  excerpt: 'Short summary.',
  imageUrl: null,
  imageThumbUrl: null,
  imageAlt: null,
  category: { name: 'Robotics', slug: 'robotics' },
  author: { name: 'Adam Pond', slug: 'adam-pond' },
  tags: [],
  sourceUrl: 'https://aimagazine.com/news/a-headline',
  publishedAt: '2026-11-02T09:27:50.755Z',
  isFeatured: false,
  seo: { metaTitle: null, metaDescription: null, ogImage: null, noindex: false },
};

describe('pagination helpers', () => {
  it('parses optional catch-all segments', () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage([])).toBe(1);
    expect(parsePage(['page', '2'])).toBe(2);
    expect(parsePage(['page', '1'])).toBe('redirect');
    for (const bad of [
      ['page'],
      ['page', '0'],
      ['page', 'x'],
      ['foo', '2'],
      ['page', '2', '3'],
      ['page', '99999'],
    ]) {
      expect(parsePage(bad)).toBeNull();
    }
  });
  it('builds clean paths', () => {
    expect(pagePath('/category/x', 1)).toBe('/category/x');
    expect(pagePath('/category/x', 3)).toBe('/category/x/page/3');
  });
});

describe('structured data', () => {
  it('NewsArticle links back to the original source', () => {
    const ld = newsArticleLd(article, branding);
    expect(ld['@type']).toBe('NewsArticle');
    expect(ld.isBasedOn?.url).toBe(article.sourceUrl);
    expect(ld.mainEntityOfPage['@id']).toMatch(/\/article\/a-headline$/);
    expect(ld.image[0]).toMatch(/\/og\/a-headline$/);
    expect(ld.author?.name).toBe('Adam Pond');
  });
  it('our own articles are not "based on" anything, and the publisher is our site', () => {
    const ld = newsArticleLd({ ...article, kind: 'original', sourceUrl: null }, branding);
    expect(ld).not.toHaveProperty('isBasedOn');
    expect(ld.publisher.name).toBe('Test Site');
  });
  it('BreadcrumbList positions are 1-based and absolute', () => {
    const ld = breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Robotics', path: '/category/robotics' },
    ]);
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement[1]!.item).toMatch(/^https?:\/\/.+\/category\/robotics$/);
  });
  it('WebSite exposes a SearchAction', () => {
    expect(websiteLd(branding).potentialAction['@type']).toBe('SearchAction');
  });
});

describe('xml escaping', () => {
  it('escapes markup characters', () => {
    expect(esc(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;',
    );
  });
});
