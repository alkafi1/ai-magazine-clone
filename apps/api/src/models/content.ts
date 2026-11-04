import { Schema, model } from 'mongoose';

/** Uploaded images (logo, favicon, article covers). Stored in MongoDB so backups include them. */
const mediaSchema = new Schema({
  filename: { type: String, required: true },
  mime: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  createdAt: { type: Date, default: Date.now },
});
mediaSchema.index({ createdAt: -1 });
export const Media = model('Media', mediaSchema);

/** Custom pages (/p/<slug>); a page with slug about/contact/privacy/terms/dmca overrides the built-in one. */
const pageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, required: true, maxlength: 100_000 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    seo: {
      metaTitle: String,
      metaDescription: String,
      noindex: { type: Boolean, default: false },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true },
);
export const Page = model('Page', pageSchema);
