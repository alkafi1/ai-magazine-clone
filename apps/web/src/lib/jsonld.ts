import { SITE, abs } from './site';
import type { Article } from './types';

import type { Branding } from './api';

const publisher = (b: Pick<Branding, 'name' | 'logoUrl'>) => ({
  '@type': 'Organization',
  name: b.name,
  url: SITE.url,
  logo: { '@type': 'ImageObject', url: b.logoUrl || abs('/icon.svg') },
});

export const organizationLd = (b: Branding) => ({
  '@context': 'https://schema.org',
  ...publisher(b),
  sameAs: [],
});

export const websiteLd = (b: Branding) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: b.name,
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

/** NewsArticle. Aggregated stories carry isBasedOn (the original reporting); our own articles do not. */
export const newsArticleLd = (a: Article, b: Branding) => ({
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
  publisher: publisher(b),
  ...(a.kind === 'scraped' && a.sourceUrl
    ? {
        isBasedOn: {
          '@type': 'NewsArticle',
          url: a.sourceUrl,
          publisher: { '@type': 'Organization', name: SITE.sourceName, url: SITE.sourceUrl },
        },
      }
    : {}),
});
