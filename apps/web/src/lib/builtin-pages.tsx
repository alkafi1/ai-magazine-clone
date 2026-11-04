import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CustomPageView } from '@/components/CustomPageView';
import { getBranding, getPage, type Branding } from './api';

/**
 * The built-in About / Contact / Privacy / Terms / DMCA pages. If an admin has created a custom page with
 * the same slug (Admin → Pages), that page is shown instead.
 */
export async function builtinMetadata(
  slug: string,
  title: string,
  description: (b: Branding) => string,
): Promise<Metadata> {
  const [custom, b] = await Promise.all([getPage(slug), getBranding()]);
  if (custom) {
    return {
      title: custom.seo.metaTitle ?? custom.title,
      description: custom.seo.metaDescription ?? undefined,
      alternates: { canonical: `/${slug}` },
      robots: custom.seo.noindex ? { index: false, follow: true } : undefined,
    };
  }
  return { title, description: description(b), alternates: { canonical: `/${slug}` } };
}

export async function builtinPage(
  slug: string,
  fallback: (b: Branding) => ReactNode,
): Promise<ReactNode> {
  const custom = await getPage(slug);
  if (custom) return <CustomPageView page={custom} path={`/${slug}`} />;
  return fallback(await getBranding());
}
