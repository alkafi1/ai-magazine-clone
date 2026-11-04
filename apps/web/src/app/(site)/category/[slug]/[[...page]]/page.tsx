import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Listing } from '@/components/Listing';
import { getArticles, getCategories } from '@/lib/api';
import { pagePath, parsePage } from '@/lib/format';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string; page?: string[] }> };

const find = async (slug: string) => (await getCategories()).find((c) => c.slug === slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page: seg } = await params;
  const cat = await find(slug);
  const p = parsePage(seg);
  const page = typeof p === 'number' ? p : 1;
  if (!cat) return { title: 'Not found', robots: { index: false } };
  const description =
    cat.description ?? `The latest ${cat.name} news and analysis, curated from across the web.`;
  return {
    title: page > 1 ? `${cat.name} — page ${page}` : cat.name,
    description,
    alternates: { canonical: pagePath(`/category/${slug}`, page) },
    openGraph: { title: cat.name, description, url: pagePath(`/category/${slug}`, page) },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug, page: seg } = await params;
  const p = parsePage(seg);
  if (p === 'redirect') permanentRedirect(`/category/${slug}`);
  if (p === null) notFound();
  const [cat, data] = await Promise.all([find(slug), getArticles({ category: slug }, p)]);
  if (!cat || !data || (p > 1 && data.items.length === 0)) notFound();
  return (
    <Listing
      title={cat.name}
      intro={cat.description}
      crumbs={[
        { name: 'Home', path: '/' },
        { name: cat.name, path: `/category/${slug}` },
      ]}
      items={data.items}
      base={`/category/${slug}`}
      page={p}
      totalPages={data.totalPages ?? 1}
    />
  );
}
