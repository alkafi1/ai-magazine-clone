import {
  toPublicConfig,
  defaultAdsSettings,
  defaultSiteSettings,
  type PublicConfig,
} from '@aimag/shared';
import type { Article, Category, HomeData, Paged, Ref } from './types';

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const REVALIDATE = 300;

/** GET from the API with ISR + cache tags. Returns null for 404/410; throws on other errors. */
async function get<T>(path: string, tags: string[], revalidate = REVALIDATE): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'x-internal-secret': process.env.REVALIDATE_SECRET ?? '' },
    next: { revalidate, tags },
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined) p.set(k, String(v));
  return p.toString();
};

export const PAGE_SIZE = 12;

export const getHome = () => get<HomeData>('/api/home', ['home']);
export const getArticle = (slug: string) =>
  get<Article>(`/api/articles/${slug}`, [`article:${slug}`]);
export const getRelated = async (slug: string) =>
  (await get<{ items: Article[] }>(`/api/articles/${slug}/related`, [`article:${slug}`]))?.items ??
  [];
export const getCategories = async () =>
  (await get<{ items: Category[] }>('/api/categories', ['categories']))?.items ?? [];

type ListFilter = { category?: string; tag?: string; author?: string };
export const getArticles = (filter: ListFilter, page: number) => {
  const tag = filter.category
    ? `category:${filter.category}`
    : filter.tag
      ? `tag:${filter.tag}`
      : filter.author
        ? `author:${filter.author}`
        : 'latest';
  return get<Paged<Article>>(`/api/articles?${qs({ ...filter, page, limit: PAGE_SIZE })}`, [
    tag,
    'home',
  ]);
};

export const getTag = (slug: string) => get<Ref>(`/api/tags/${slug}`, [`tag:${slug}`]);
export const getAuthor = (slug: string) =>
  get<Ref & { bio: string | null; articleCount: number }>(`/api/authors/${slug}`, [
    `author:${slug}`,
  ]);

export const search = (q: string, page: number) =>
  get<Paged<Article> & { query: string }>(
    `/api/search?${qs({ q, page, limit: PAGE_SIZE })}`,
    ['search'],
    60,
  );

export const getFeed = async () =>
  (await get<Paged<Article>>('/api/articles?limit=30', ['home']))?.items ?? [];

export const getSitemapArticles = (page: number) =>
  get<{ pageCount: number; items: { slug: string; updatedAt: string }[] }>(
    `/api/sitemap/articles?page=${page}`,
    ['home'],
  );
export const getSitemapNews = async () =>
  (
    await get<{ items: { slug: string; title: string; publishedAt: string }[] }>(
      '/api/sitemap/news',
      ['home'],
      60,
    )
  )?.items ?? [];
export const getSitemapPages = () =>
  get<{ categories: string[]; tags: string[]; authors: string[]; pages: string[] }>(
    '/api/sitemap/pages',
    ['home'],
  );

const defaultConfig = () => toPublicConfig(defaultSiteSettings(), defaultAdsSettings());

/** Fill in anything missing (older cached response, API on an older version) so the site never crashes on it. */
function withDefaults(raw: Partial<PublicConfig> | null): PublicConfig {
  const d = defaultConfig();
  if (!raw) return d;
  return {
    ...d,
    ...raw,
    branding: { ...d.branding, ...raw.branding },
    navigation: {
      ...d.navigation,
      ...raw.navigation,
      header: { ...d.navigation.header, ...raw.navigation?.header },
    },
    features: { ...d.features, ...raw.features },
    ads: { ...d.ads, ...raw.ads },
    social: { ...d.social, ...raw.social },
  };
}

/** Admin-controlled settings (announcement, ads, analytics, social, flags, branding, theme, menus). Falls back to safe defaults. */
export async function getSiteConfig(): Promise<PublicConfig> {
  try {
    return withDefaults(await get<PublicConfig>('/api/site-config', ['settings'], 60));
  } catch {
    return defaultConfig();
  }
}

export type Branding = PublicConfig['branding'];

/** Site name, tagline, logo etc. from the admin Appearance settings (cached; safe defaults if the API is down). */
export async function getBranding(): Promise<Branding> {
  const b = (await getSiteConfig()).branding;
  return {
    ...b,
    contactEmail: b.contactEmail || process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'editor@example.com',
  };
}

export type CustomPage = {
  slug: string;
  title: string;
  body: string;
  seo: { metaTitle: string | null; metaDescription: string | null; noindex: boolean };
  updatedAt: string;
};
export const getPage = (slug: string) => get<CustomPage>(`/api/pages/${slug}`, [`page:${slug}`]);
