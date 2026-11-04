import {
  adsSettingsSchema,
  appearanceSettingsSchema,
  defaultAdsSettings,
  defaultAppearanceSettings,
  defaultSiteSettings,
  siteSettingsSchema,
} from '@aimag/shared';
import { Router } from 'express';
import { z } from 'zod';
import { readSettings, writeSettings } from '../../db/settings.js';
import { AuditLog, Media, NewsletterSubscriber } from '../../models/index.js';
import { revalidateWeb } from '../../scheduler/revalidate.js';
import { audit } from '../audit.js';
import { requirePermission } from '../middleware/auth.js';
import { clearCache } from '../middleware/cache.js';
import { HttpError, parse } from '../middleware/error.js';
import { escapeRegex, limit, objectId, page } from '../validators.js';

/** Spreadsheet apps run cells that start with = + - @ as formulas; prefix them so exports are inert. */
const csvCell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function adminMiscRouter() {
  const r = Router();

  // ---- audit log ----------------------------------------------------------------------------
  r.get('/audit', requirePermission('audit.view'), async (req, res) => {
    const q = parse(
      z.object({
        page,
        limit,
        actor: z.string().trim().max(254).optional(),
        action: z.string().trim().max(60).optional(),
      }),
      req.query,
    );
    const filter: Record<string, unknown> = {};
    if (q.actor) filter.actorEmail = { $regex: escapeRegex(q.actor), $options: 'i' };
    if (q.action) filter.action = { $regex: `^${escapeRegex(q.action)}` };
    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ at: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({
      items: items.map((a) => ({
        id: String(a._id),
        at: a.at,
        actor: a.actorEmail ?? null,
        action: a.action,
        target: a.target ?? null,
        meta: a.meta ?? null,
        ip: a.ip ?? null,
      })),
      page: q.page,
      limit: q.limit,
      total,
    });
  });

  // ---- newsletter subscribers ---------------------------------------------------------------
  r.get('/subscribers', requirePermission('subscribers.view'), async (req, res) => {
    const q = parse(z.object({ page, limit, q: z.string().trim().max(100).optional() }), req.query);
    const filter = q.q ? { email: { $regex: escapeRegex(q.q), $options: 'i' } } : {};
    const [items, total] = await Promise.all([
      NewsletterSubscriber.find(filter)
        .sort({ subscribedAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      NewsletterSubscriber.countDocuments(filter),
    ]);
    res.json({
      items: items.map((s) => ({
        id: String(s._id),
        email: s.email,
        subscribedAt: s.subscribedAt,
      })),
      page: q.page,
      limit: q.limit,
      total,
    });
  });

  r.get('/subscribers/export.csv', requirePermission('subscribers.manage'), async (req, res) => {
    const rows = await NewsletterSubscriber.find().sort({ subscribedAt: -1 }).limit(100_000).lean();
    await audit(req, 'subscribers.export', undefined, { count: rows.length });
    const csv = [
      'email,subscribed_at',
      ...rows.map((s) => `${csvCell(s.email)},${s.subscribedAt.toISOString()}`),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  });

  r.delete('/subscribers/:id', requirePermission('subscribers.manage'), async (req, res) => {
    const id = parse(objectId, req.params.id);
    const s = await NewsletterSubscriber.findByIdAndDelete(id);
    if (!s) throw new HttpError(404, 'not found');
    await audit(req, 'subscriber.delete', s.email);
    res.status(204).end();
  });

  // ---- settings -----------------------------------------------------------------------------
  r.get('/settings/site', requirePermission('settings.manage'), async (_req, res) => {
    res.json(await readSettings('site', siteSettingsSchema, defaultSiteSettings));
  });

  r.put('/settings/site', requirePermission('settings.manage'), async (req, res) => {
    const value = parse(siteSettingsSchema, req.body);
    await writeSettings('site', value);
    await audit(req, 'settings.site_update');
    clearCache();
    void revalidateWeb({ extraTags: ['settings'] });
    res.json(value);
  });

  r.get('/settings/appearance', requirePermission('appearance.manage'), async (_req, res) => {
    res.json(await readSettings('appearance', appearanceSettingsSchema, defaultAppearanceSettings));
  });

  r.put('/settings/appearance', requirePermission('appearance.manage'), async (req, res) => {
    const value = parse(appearanceSettingsSchema, req.body);
    const ids = [
      value.branding.logoMediaId,
      value.branding.logoDarkMediaId,
      value.branding.faviconMediaId,
    ].filter(Boolean);
    if (ids.length && (await Media.countDocuments({ _id: { $in: ids } })) !== new Set(ids).size) {
      throw new HttpError(400, 'one of the chosen images no longer exists');
    }
    await writeSettings('appearance', value);
    await audit(req, 'settings.appearance_update', undefined, {
      theme: value.theme,
      name: value.branding.name,
    });
    clearCache();
    void revalidateWeb({ extraTags: ['settings', 'categories'] });
    res.json(value);
  });

  r.get('/settings/ads', requirePermission('ads.manage'), async (_req, res) => {
    res.json(await readSettings('ads', adsSettingsSchema, defaultAdsSettings));
  });

  r.put('/settings/ads', requirePermission('ads.manage'), async (req, res) => {
    const value = parse(adsSettingsSchema, req.body);
    await writeSettings('ads', value);
    await audit(req, 'settings.ads_update', undefined, {
      enabled: value.enabled,
      provider: value.provider,
    });
    clearCache();
    void revalidateWeb({ extraTags: ['settings'] });
    res.json(value);
  });

  return r;
}
