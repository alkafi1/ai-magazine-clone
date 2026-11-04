import { Schema, model } from 'mongoose';

const categorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  sourcePath: String,
  order: { type: Number, default: 100 },
  showInMenu: { type: Boolean, default: true },
  seo: { metaTitle: String, metaDescription: String, noindex: Boolean },
});
export const Category = model('Category', categorySchema);

const authorSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  avatarUrl: String,
  bio: String,
  sourceUrl: String,
});
export const Author = model('Author', authorSchema);

const tagSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
});
export const Tag = model('Tag', tagSchema);
