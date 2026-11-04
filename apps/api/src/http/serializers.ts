type Populated = {
  _id: unknown;
  title: string;
  slug: string;
  excerpt: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  category?: { name?: string; slug?: string } | null;
  author?: { name?: string; slug?: string } | null;
  tags?: { name?: string; slug?: string }[];
  sourceUrl: string;
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
export function publicArticle(a: unknown) {
  const d = a as Populated;
  return {
    id: String(d._id),
    title: d.title,
    slug: d.slug,
    excerpt: d.excerpt,
    imageUrl: d.imageUrl ?? null,
    imageAlt: d.imageAlt ?? null,
    category: ref(d.category),
    author: ref(d.author),
    tags: (d.tags ?? []).map((t) => ref(t)).filter(Boolean),
    sourceUrl: d.sourceUrl,
    publishedAt: d.publishedAt,
    isFeatured: !!d.isFeatured,
    readingTimeMin: d.readingTimeMin ?? null,
    seo: {
      metaTitle: d.seo?.metaTitle ?? null,
      metaDescription: d.seo?.metaDescription ?? null,
      ogImage: d.seo?.ogImage ?? null,
      noindex: !!d.seo?.noindex,
    },
  };
}
