import { Schema, model } from 'mongoose';

const adminUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    // Built-in role key (super_admin, editor, ...) or the key of a custom Role document.
    role: { type: String, required: true, default: 'viewer' },
    /** Disabled accounts cannot sign in and their existing sessions stop working immediately. */
    active: { type: Boolean, default: true },
    /** Bumped on password change, role change and disable: invalidates every token issued before. */
    tokenVersion: { type: Number, default: 0 },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
    passwordChangedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true },
);
export const AdminUser = model('AdminUser', adminUserSchema);

const auditLogSchema = new Schema({
  // Not required and not a hard reference: entries must survive deleting the account, and failed
  // logins have no account to point at. The email is a snapshot.
  admin: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  actorEmail: String,
  action: { type: String, required: true },
  target: String,
  meta: Schema.Types.Mixed,
  ip: String,
  at: { type: Date, default: Date.now },
});
auditLogSchema.index({ at: -1 });
auditLogSchema.index({ admin: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });
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
