import { Schema, model, type InferSchemaType } from 'mongoose';

const seoSchema = new Schema(
  {
    metaTitle: String,
    metaDescription: String,
    canonicalUrl: String,
    ogImage: String,
    noindex: { type: Boolean, default: false },
  },
  { _id: false },
);

const articleSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true },
  // Scraped stories keep a short excerpt (<= 200 chars, enforced by the scraper's schema); our own articles may use a bit more.
  excerpt: { type: String, required: true, maxlength: 300 },
  imageUrl: String,
  imageThumbUrl: String,
  imageAlt: String,
  imageCredit: String,
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'Author' },
  tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
  /**
   * scraped  = aggregated headline from the source site: title/excerpt/image link only, NEVER a body.
   * original = written by us in the admin: has a body (markdown) and no source.
   */
  kind: { type: String, enum: ['scraped', 'original'], default: 'scraped' },
  body: { type: String, maxlength: 100_000 },
  imageMedia: { type: Schema.Types.ObjectId, ref: 'Media' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  sourceUrl: {
    type: String,
    required: function (this: { kind?: string }) {
      return this.kind !== 'original';
    },
  },
  sourceSlug: String,
  sourceHash: {
    type: String,
    required: function (this: { kind?: string }) {
      return this.kind !== 'original';
    },
  },
  publishedAt: { type: Date, required: true },
  sourceModifiedAt: Date,
  scrapedAt: { type: Date, default: Date.now },
  isFeatured: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  readingTimeMin: Number,
  seo: { type: seoSchema, default: () => ({}) },
  status: {
    type: String,
    enum: ['published', 'hidden', 'failed-parse', 'draft', 'scheduled'],
    default: 'published',
  },
  lastRun: { type: Schema.Types.ObjectId, ref: 'ScrapeRun' },
});

// Partial: original articles have no sourceUrl, and several documents may lack it.
articleSchema.index(
  { sourceUrl: 1 },
  { unique: true, partialFilterExpression: { sourceUrl: { $type: 'string' } } },
);
articleSchema.index({ slug: 1 }, { unique: true });
articleSchema.index({ category: 1, publishedAt: -1 });
articleSchema.index({ isFeatured: 1, publishedAt: -1 });
articleSchema.index({ isHidden: 1, status: 1, publishedAt: -1 });
articleSchema.index(
  { title: 'text', excerpt: 'text', body: 'text' },
  { weights: { title: 10, excerpt: 5, body: 1 }, name: 'article_text' },
);
articleSchema.index({ kind: 1, status: 1, publishedAt: -1 }); // admin filters, scheduler
articleSchema.index({ tags: 1, publishedAt: -1 });
// Added after the query-plan review (pnpm db:explain), beyond the original PLAN.md table:
articleSchema.index({ author: 1, publishedAt: -1 }); // author pages
articleSchema.index({ isHidden: 1, status: 1, viewCount: -1, publishedAt: -1 }); // sort=popular
articleSchema.index({ publishedAt: -1 }); // admin list (no visibility filter)

export type ArticleDoc = InferSchemaType<typeof articleSchema>;
export const Article = model('Article', articleSchema);
