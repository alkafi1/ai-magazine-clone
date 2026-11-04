import * as cheerio from 'cheerio';

/** Raw fields pulled from a page, before normalizing. No body text is ever read. */
export type RawArticle = {
  title: string | null;
  description: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  authorName: string | null;
  categoryName: string | null;
  sectionSlug: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  canonicalUrl: string | null;
  source: 'next-data' | 'json-ld' | 'meta';
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Preferred image variants, best first. */
const IMAGE_KEYS = [
  'share_widescreen_1200',
  'hero_widescreen_900',
  'thumbnail_landscape_900',
  'thumbnail_landscape_580',
];

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Layer 1: the site's embedded Next.js data. */
export function parseNextData($: cheerio.CheerioAPI): RawArticle | null {
  const text = $('script#__NEXT_DATA__').first().text();
  if (!text) return null;
  let article: unknown;
  try {
    article = (JSON.parse(text) as { props?: { pageProps?: { article?: unknown } } }).props
      ?.pageProps?.article;
  } catch {
    return null;
  }
  if (!isDict(article)) return null;

  let imageUrl: string | null = null;
  let imageAlt: string | null = null;
  const images = isDict(article.images) ? article.images : {};
  for (const key of IMAGE_KEYS) {
    const first = Array.isArray(images[key]) ? (images[key] as unknown[])[0] : null;
    if (isDict(first) && str(first.url)) {
      imageUrl = str(first.url);
      imageAlt = str(first.caption);
      break;
    }
  }
  const author = isDict(article.author) ? str(article.author.name) : null;
  const section = isDict(article.section) ? str(article.section.slug) : null;
  const path = str(article.fullUrlPath);

  return {
    title: str(article.headline),
    description: str(article.metaDescription) ?? str(article.sell),
    publishedAt: str(article.displayDate),
    modifiedAt: null,
    authorName: author,
    categoryName: str(article.category),
    sectionSlug: section,
    imageUrl,
    imageAlt,
    canonicalUrl: str(article.canonicalUrl) ?? (path ? new URL(path, 'https://x').pathname : null),
    source: 'next-data',
  };
}

/** Layer 2: schema.org NewsArticle JSON-LD. */
export function parseJsonLd($: cheerio.CheerioAPI): RawArticle | null {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    let data: unknown;
    try {
      data = JSON.parse($(el).text());
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    const node = nodes.find((n) => isDict(n) && /Article/.test(String(n['@type'])));
    if (!isDict(node)) continue;
    const img = Array.isArray(node.image) ? node.image[0] : node.image;
    const author = Array.isArray(node.author) ? node.author[0] : node.author;
    return {
      title: str(node.headline),
      description: str(node.description),
      publishedAt: str(node.datePublished),
      modifiedAt: str(node.dateModified),
      authorName: isDict(author) ? str(author.name) : str(author),
      categoryName: str(node.articleSection),
      sectionSlug: null,
      imageUrl: isDict(img) ? str(img.url) : str(img),
      imageAlt: isDict(img) ? str(img.caption) : null,
      canonicalUrl: str(node.url),
      source: 'json-ld',
    };
  }
  return null;
}

/** Layer 3: Open Graph / standard meta tags. */
export function parseMeta($: cheerio.CheerioAPI): RawArticle {
  const meta = (name: string) =>
    str($(`meta[property="${name}"]`).attr('content') ?? $(`meta[name="${name}"]`).attr('content'));
  return {
    title: meta('og:title') ?? str($('title').text()),
    description: meta('description') ?? meta('og:description'),
    publishedAt: meta('article:published_time'),
    modifiedAt: meta('article:modified_time'),
    authorName: meta('article:author'),
    categoryName: meta('article:section'),
    sectionSlug: null,
    imageUrl: meta('og:image'),
    imageAlt: meta('og:image:alt'),
    canonicalUrl: str($('link[rel="canonical"]').attr('href')) ?? meta('og:url'),
    source: 'meta',
  };
}

/** Take the first non-null value for each field, in layer order. */
export function parseArticleHtml(html: string): RawArticle | null {
  const $ = cheerio.load(html);
  const layers = [parseNextData($), parseJsonLd($), parseMeta($)].filter(
    (l): l is RawArticle => l !== null,
  );
  if (layers.length === 0) return null;
  const merged: RawArticle = { ...layers[0]! };
  for (const layer of layers.slice(1)) {
    for (const key of Object.keys(merged) as (keyof RawArticle)[]) {
      if (merged[key] === null) (merged as Record<string, unknown>)[key] = layer[key];
    }
  }
  // Not meaningful for a merged result, but handy for logs: which layer supplied the title.
  merged.source = layers.find((l) => l.title)?.source ?? layers[0]!.source;
  return merged.title && merged.publishedAt ? merged : null;
}
