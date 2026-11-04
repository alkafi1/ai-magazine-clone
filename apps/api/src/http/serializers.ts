import { config } from '../config/index.js';
type Populated = {
  kind?: string;
  body?: string | null;
  imageMedia?: unknown;
  _id: unknown;
  title: string;
  slug: string;
  excerpt: string;
  imageUrl?: string | null;
  imageThumbUrl?: string | null;
  imageAlt?: string | null;
  category?: { name?: string; slug?: string } | null;
  author?: { name?: string; slug?: string } | null;
  tags?: { name?: string; slug?: string }[];
  sourceUrl?: string | null;
  publishedAt: Date;
  isFeatured?: boolean;
  viewCount?: number;
  readingTimeMin?: number | null;
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    ogImage?: string | null;
    noindex?: boolean | null;
  } | null;
};

const ref = (r?: { name?: string; slug?: string } | null) =>
  r && r.slug ? { name: r.name, slug: r.slug } : null;

/**
 * Public article shape. Never includes anything but the allowed metadata fields.
 * Takes `unknown` because lean() types populated refs as ObjectIds; callers populate category/author/tags.
 */
export function publicArticle(a: unknown, opts: { body?: boolean } = {}) {
  const d = a as Populated;
  const original = d.kind === 'original';
  // Uploaded covers are served by this API; scraped stories hotlink the source's own image URLs.
  const media = d.imageMedia ? `${config.publicApiUrl}/api/media/${String(d.imageMedia)}` : null;
  return {
    id: String(d._id),
    kind: original ? 'original' : 'scraped',
    title: d.title,
    slug: d.slug,
    excerpt: d.excerpt,
    imageUrl: media ?? d.imageUrl ?? null,
    imageThumbUrl: media ?? d.imageThumbUrl ?? d.imageUrl ?? null,
    imageAlt: d.imageAlt ?? null,
    category: ref(d.category),
    author: ref(d.author),
    tags: (d.tags ?? []).map((t) => ref(t)).filter(Boolean),
    // Original articles have no source. Scraped ones never expose a body, whatever is in the database.
    sourceUrl: original ? null : (d.sourceUrl ?? null),
    publishedAt: d.publishedAt,
    isFeatured: !!d.isFeatured,
    readingTimeMin: d.readingTimeMin ?? null,
    ...(original && opts.body ? { body: d.body ?? '' } : {}),
    seo: {
      metaTitle: d.seo?.metaTitle ?? null,
      metaDescription: d.seo?.metaDescription ?? null,
      ogImage: d.seo?.ogImage ?? null,
      noindex: !!d.seo?.noindex,
    },
  };
}
