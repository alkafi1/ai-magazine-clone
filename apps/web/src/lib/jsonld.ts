import { SITE, abs } from './site';
import type { Article } from './types';

const publisher = {
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  logo: { '@type': 'ImageObject', url: abs('/icon.svg') },
};

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  ...publisher,
  sameAs: [],
});

export const websiteLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  url: SITE.url,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
});

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    item: abs(it.path),
  })),
});

/** NewsArticle for our curated page; isBasedOn points at the original reporting. */
export const newsArticleLd = (a: Article) => ({
  '@context': 'https://schema.org',
  '@type': 'NewsArticle',
  headline: a.title.slice(0, 110),
  description: a.seo.metaDescription ?? a.excerpt,
  url: abs(`/article/${a.slug}`),
  mainEntityOfPage: { '@type': 'WebPage', '@id': abs(`/article/${a.slug}`) },
  image: [abs(`/og/${a.slug}`)],
  datePublished: a.publishedAt,
  dateModified: a.publishedAt,
  inLanguage: 'en',
  isAccessibleForFree: true,
  articleSection: a.category?.name,
  author: a.author
    ? { '@type': 'Person', name: a.author.name, url: abs(`/author/${a.author.slug}`) }
    : undefined,
  publisher,
  isBasedOn: {
    '@type': 'NewsArticle',
    url: a.sourceUrl,
    publisher: { '@type': 'Organization', name: SITE.sourceName, url: SITE.sourceUrl },
  },
});
