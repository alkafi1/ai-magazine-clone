import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Listing } from '@/components/Listing';
import { getArticles } from '@/lib/api';
import { pagePath, parsePage } from '@/lib/format';

export const revalidate = 300;
type Props = { params: Promise<{ page?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = parsePage((await params).page);
  const page = typeof p === 'number' ? p : 1;
  return {
    title: page > 1 ? `Latest AI news — page ${page}` : 'Latest AI news',
    description: 'Every new story, newest first.',
    alternates: { canonical: pagePath('/latest', page) },
  };
}

export default async function LatestPage({ params }: Props) {
  const p = parsePage((await params).page);
  if (p === 'redirect') permanentRedirect('/latest');
  if (p === null) notFound();
  const data = await getArticles({}, p);
  if (!data || (p > 1 && data.items.length === 0)) notFound();
  return (
    <Listing
      title="Latest AI news"
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Latest', path: '/latest' },
      ]}
      items={data.items}
      base="/latest"
      page={p}
      totalPages={data.totalPages ?? 1}
    />
  );
}
