import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Listing } from '@/components/Listing';
import { getArticles, getTag } from '@/lib/api';
import { pagePath, parsePage } from '@/lib/format';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string; page?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page: seg } = await params;
  const tag = await getTag(slug);
  const p = parsePage(seg);
  const page = typeof p === 'number' ? p : 1;
  if (!tag) return { title: 'Not found', robots: { index: false } };
  return {
    title: page > 1 ? `${tag.name} — page ${page}` : `${tag.name} news`,
    description: `Stories tagged ${tag.name}.`,
    alternates: { canonical: pagePath(`/tag/${slug}`, page) },
  };
}

export default async function TagPage({ params }: Props) {
  const { slug, page: seg } = await params;
  const p = parsePage(seg);
  if (p === 'redirect') permanentRedirect(`/tag/${slug}`);
  if (p === null) notFound();
  const [tag, data] = await Promise.all([getTag(slug), getArticles({ tag: slug }, p)]);
  if (!tag || !data || (p > 1 && data.items.length === 0)) notFound();
  return (
    <Listing
      title={`#${tag.name}`}
      crumbs={[
        { name: 'Home', path: '/' },
        { name: tag.name, path: `/tag/${slug}` },
      ]}
      items={data.items}
      base={`/tag/${slug}`}
      page={p}
      totalPages={data.totalPages ?? 1}
    />
  );
}
