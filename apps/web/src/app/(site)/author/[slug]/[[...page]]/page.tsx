import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Listing } from '@/components/Listing';
import { getArticles, getAuthor } from '@/lib/api';
import { pagePath, parsePage } from '@/lib/format';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string; page?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page: seg } = await params;
  const author = await getAuthor(slug);
  const p = parsePage(seg);
  const page = typeof p === 'number' ? p : 1;
  if (!author) return { title: 'Not found', robots: { index: false } };
  return {
    title: page > 1 ? `${author.name} — page ${page}` : `${author.name}: stories`,
    description: `AI news stories reported by ${author.name}, summarised on Synthwire.`,
    alternates: { canonical: pagePath(`/author/${slug}`, page) },
  };
}

export default async function AuthorPage({ params }: Props) {
  const { slug, page: seg } = await params;
  const p = parsePage(seg);
  if (p === 'redirect') permanentRedirect(`/author/${slug}`);
  if (p === null) notFound();
  const [author, data] = await Promise.all([getAuthor(slug), getArticles({ author: slug }, p)]);
  if (!author || !data || (p > 1 && data.items.length === 0)) notFound();
  return (
    <Listing
      title={author.name}
      intro={author.bio ?? `${author.articleCount} stories originally reported by ${author.name}.`}
      crumbs={[
        { name: 'Home', path: '/' },
        { name: author.name, path: `/author/${slug}` },
      ]}
      items={data.items}
      base={`/author/${slug}`}
      page={p}
      totalPages={data.totalPages ?? 1}
    />
  );
}
