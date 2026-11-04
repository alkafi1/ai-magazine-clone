import { Schema, model } from 'mongoose';

const adminUserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor'], default: 'admin' },
  lastLoginAt: Date,
});
export const AdminUser = model('AdminUser', adminUserSchema);

const auditLogSchema = new Schema({
  admin: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: true },
  action: { type: String, required: true },
  target: String,
  at: { type: Date, default: Date.now },
});
export const AuditLog = model('AuditLog', auditLogSchema);

const newsletterSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  confirmed: { type: Boolean, default: false },
  subscribedAt: { type: Date, default: Date.now },
});
export const NewsletterSubscriber = model('NewsletterSubscriber', newsletterSchema);

const siteSettingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: Schema.Types.Mixed,
});
export const SiteSetting = model('SiteSetting', siteSettingSchema);
