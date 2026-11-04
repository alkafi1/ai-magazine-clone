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
  excerpt: { type: String, required: true, maxlength: 200 },
  imageUrl: String,
  imageAlt: String,
  imageCredit: String,
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'Author' },
  tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
  sourceUrl: { type: String, required: true },
  sourceSlug: String,
  sourceHash: { type: String, required: true },
  publishedAt: { type: Date, required: true },
  sourceModifiedAt: Date,
  scrapedAt: { type: Date, default: Date.now },
  isFeatured: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  readingTimeMin: Number,
  seo: { type: seoSchema, default: () => ({}) },
  status: { type: String, enum: ['published', 'hidden', 'failed-parse'], default: 'published' },
  lastRun: { type: Schema.Types.ObjectId, ref: 'ScrapeRun' },
});

articleSchema.index({ sourceUrl: 1 }, { unique: true });
articleSchema.index({ slug: 1 }, { unique: true });
articleSchema.index({ category: 1, publishedAt: -1 });
articleSchema.index({ isFeatured: 1, publishedAt: -1 });
articleSchema.index({ isHidden: 1, status: 1, publishedAt: -1 });
articleSchema.index({ title: 'text', excerpt: 'text' });
articleSchema.index({ tags: 1, publishedAt: -1 });

export type ArticleDoc = InferSchemaType<typeof articleSchema>;
export const Article = model('Article', articleSchema);
