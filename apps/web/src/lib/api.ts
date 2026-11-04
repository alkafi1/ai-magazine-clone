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
  const res = await fetch(`${API}${path}`, { next: { revalidate, tags } });
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
  get<{ categories: string[]; tags: string[]; authors: string[] }>('/api/sitemap/pages', ['home']);

/** Admin-controlled settings (announcement, ads, analytics, social, flags). Falls back to safe defaults if the API is down. */
export async function getSiteConfig(): Promise<PublicConfig> {
  try {
    return (
      (await get<PublicConfig>('/api/site-config', ['settings'], 60)) ??
      toPublicConfig(defaultSiteSettings(), defaultAdsSettings())
    );
  } catch {
    return toPublicConfig(defaultSiteSettings(), defaultAdsSettings());
  }
}
