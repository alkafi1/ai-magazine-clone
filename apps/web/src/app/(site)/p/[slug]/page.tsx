import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CustomPageView } from '@/components/CustomPageView';
import { getPage } from '@/lib/api';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = /^[a-z0-9-]{1,120}$/.test(slug) ? await getPage(slug) : null;
  if (!p) return { title: 'Page not found', robots: { index: false } };
  return {
    title: p.seo.metaTitle ?? p.title,
    description: p.seo.metaDescription ?? undefined,
    alternates: { canonical: `/p/${slug}` },
    robots: p.seo.noindex ? { index: false, follow: true } : undefined,
  };
}

export default async function CustomPage({ params }: Props) {
  const { slug } = await params;
  const p = /^[a-z0-9-]{1,120}$/.test(slug) ? await getPage(slug) : null;
  if (!p) notFound();
  return <CustomPageView page={p} path={`/p/${slug}`} />;
}
