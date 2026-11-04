export type Ref = { name: string; slug: string };

export type Article = {
  id: string;
  kind: 'scraped' | 'original';
  /** Markdown. Only present for our own (original) articles, and only on the single-article endpoint. */
  body?: string;
  title: string;
  slug: string;
  excerpt: string;
  imageUrl: string | null;
  imageThumbUrl: string | null;
  imageAlt: string | null;
  category: Ref | null;
  author: Ref | null;
  tags: Ref[];
  /** null for our own articles */
  sourceUrl: string | null;
  publishedAt: string;
  isFeatured: boolean;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: string | null;
    noindex: boolean;
  };
};

export type Paged<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
};

export type Category = {
  name: string;
  slug: string;
  description: string | null;
  showInMenu: boolean;
  articleCount: number;
};

export type HomeData = {
  hero: Article | null;
  featured: Article[];
  latest: Article[];
  sections: { category: Ref; items: Article[] }[];
  trending: Article[];
};
