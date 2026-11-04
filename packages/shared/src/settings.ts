import { z } from 'zod';

/** An https origin like https://pagead2.googlesyndication.com (no path). Used for CSP allow-lists. */
export const httpsOrigin = z
  .string()
  .trim()
  .max(200)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && u.origin === v;
    } catch {
      return false;
    }
  }, 'must be an https origin such as https://ads.example.com (no path, no trailing slash)');

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https:\/\//.test(v), 'must be empty or an https URL');

const placement = z.object({
  enabled: z.boolean(),
  /** AdSense ad unit id (digits). Used when provider = adsense. */
  slotId: z
    .string()
    .trim()
    .regex(/^(\d{6,20})?$/, 'digits only (the data-ad-slot value)'),
  /** Raw ad code. Used when provider = custom. Admin-trusted: only users with ads.manage can set it. */
  html: z.string().max(5000),
});
export type AdPlacement = z.infer<typeof placement>;

export const PLACEMENT_KEYS = [
  'headerBanner',
  'inFeed',
  'sidebar',
  'articleTop',
  'articleBottom',
] as const;
export type PlacementKey = (typeof PLACEMENT_KEYS)[number];

export const PLACEMENT_LABELS: Record<PlacementKey, string> = {
  headerBanner: 'Header banner (under the menu, every page)',
  inFeed: 'In-feed (between stories in lists)',
  sidebar: 'Sidebar (home page, next to Latest)',
  articleTop: 'Article: above the summary',
  articleBottom: 'Article: below the source box',
};

export const adsSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['adsense', 'custom']),
  adsenseClientId: z
    .string()
    .trim()
    .regex(/^(ca-pub-\d{10,20})?$/, 'looks like ca-pub-1234567890123456'),
  /** Let Google place ads automatically (in addition to the placements below). */
  autoAds: z.boolean(),
  /** Load ads only after the visitor accepts. Keep ON for EU/UK/CH visitors. */
  consentRequired: z.boolean(),
  inFeedEvery: z.number().int().min(3).max(20),
  placements: z.object({
    headerBanner: placement,
    inFeed: placement,
    sidebar: placement,
    articleTop: placement,
    articleBottom: placement,
  }),
  /** Extra script/frame hosts a non-Google network needs; added to the Content-Security-Policy. */
  scriptHosts: z.array(httpsOrigin).max(20),
  /** Extra ads.txt lines (your Google line is generated from the client id). */
  adsTxt: z.string().max(5000),
});
export type AdsSettings = z.infer<typeof adsSettingsSchema>;

const emptyPlacement = (): AdPlacement => ({ enabled: false, slotId: '', html: '' });
export const defaultAdsSettings = (): AdsSettings => ({
  enabled: false,
  provider: 'adsense',
  adsenseClientId: '',
  autoAds: false,
  consentRequired: true,
  inFeedEvery: 6,
  placements: {
    headerBanner: emptyPlacement(),
    inFeed: emptyPlacement(),
    sidebar: emptyPlacement(),
    articleTop: emptyPlacement(),
    articleBottom: emptyPlacement(),
  },
  scriptHosts: [],
  adsTxt: '',
});

export const siteSettingsSchema = z.object({
  announcement: z.object({
    enabled: z.boolean(),
    text: z.string().trim().max(200),
    /** Internal path (/latest) or https URL. */
    href: z
      .string()
      .trim()
      .max(300)
      .refine(
        (v) => v === '' || v.startsWith('/') || /^https:\/\//.test(v),
        'must be empty, a /path, or an https URL',
      ),
    tone: z.enum(['info', 'success', 'warning', 'breaking']),
    /** ISO date-time; empty = never expires. */
    expiresAt: z.string().refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'invalid date'),
  }),
  social: z.object({
    x: optionalUrl,
    linkedin: optionalUrl,
    youtube: optionalUrl,
    facebook: optionalUrl,
    instagram: optionalUrl,
  }),
  analytics: z.object({
    /** GA4 measurement id. Loaded only after the visitor accepts cookies. */
    ga4Id: z
      .string()
      .trim()
      .regex(/^(G-[A-Z0-9]{6,12})?$/, 'looks like G-ABCDEF1234'),
  }),
  features: z.object({
    newsletter: z.boolean(),
    darkModeToggle: z.boolean(),
  }),
  footerNote: z.string().trim().max(300),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const defaultSiteSettings = (): SiteSettings => ({
  announcement: { enabled: false, text: '', href: '', tone: 'info', expiresAt: '' },
  social: { x: '', linkedin: '', youtube: '', facebook: '', instagram: '' },
  analytics: { ga4Id: '' },
  features: { newsletter: true, darkModeToggle: true },
  footerNote: '',
});

/** What the public site is allowed to see (no ids of disabled things, no unused html). */
export type PublicConfig = {
  announcement: { text: string; href: string; tone: SiteSettings['announcement']['tone'] } | null;
  social: SiteSettings['social'];
  ga4Id: string;
  features: SiteSettings['features'];
  footerNote: string;
  ads: {
    enabled: boolean;
    provider: AdsSettings['provider'];
    clientId: string;
    autoAds: boolean;
    consentRequired: boolean;
    inFeedEvery: number;
    placements: Partial<Record<PlacementKey, { slotId: string; html: string }>>;
    scriptHosts: string[];
    adsTxt: string;
  };
};

export function toPublicConfig(
  site: SiteSettings,
  ads: AdsSettings,
  now = new Date(),
): PublicConfig {
  const a = site.announcement;
  const live = a.enabled && a.text !== '' && (a.expiresAt === '' || new Date(a.expiresAt) > now);
  const adsLive =
    ads.enabled &&
    ((ads.provider === 'adsense' && ads.adsenseClientId !== '') || ads.provider === 'custom');
  const placements: PublicConfig['ads']['placements'] = {};
  if (adsLive) {
    for (const key of PLACEMENT_KEYS) {
      const p = ads.placements[key];
      const usable = ads.provider === 'adsense' ? p.slotId !== '' : p.html.trim() !== '';
      if (p.enabled && usable)
        placements[key] = { slotId: p.slotId, html: ads.provider === 'custom' ? p.html : '' };
    }
  }
  return {
    announcement: live ? { text: a.text, href: a.href, tone: a.tone } : null,
    social: site.social,
    ga4Id: site.analytics.ga4Id,
    features: site.features,
    footerNote: site.footerNote,
    ads: {
      enabled: adsLive,
      provider: ads.provider,
      clientId: ads.provider === 'adsense' ? ads.adsenseClientId : '',
      autoAds: adsLive && ads.provider === 'adsense' && ads.autoAds,
      consentRequired: ads.consentRequired,
      inFeedEvery: ads.inFeedEvery,
      placements,
      scriptHosts: adsLive ? ads.scriptHosts : [],
      adsTxt: ads.adsTxt,
    },
  };
}
