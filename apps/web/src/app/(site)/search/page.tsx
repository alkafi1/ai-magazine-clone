import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleCard } from '@/components/ArticleCard';
import { SearchBox } from '@/components/SearchBox';
import { search } from '@/lib/api';

// Search results are never indexed (also blocked in robots.txt).
export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } };
type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 100);
  const page = Math.min(Math.max(Number(sp.page) || 1, 1), 100);
  const data = q.length >= 2 ? await search(q, page).catch(() => null) : null;
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;
  const href = (n: number) => `/search?q=${encodeURIComponent(q)}&page=${n}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-4xl font-extrabold">Search</h1>
      <div className="mt-4 max-w-xl">
        <SearchBox defaultValue={q} />
      </div>
      {q.length >= 2 && data && (
        <section aria-live="polite" className="mt-8">
          <p className="text-slate">
            {data.total} {data.total === 1 ? 'result' : 'results'} for “{q}”
          </p>
          {data.items.map((a) => (
            <ArticleCard key={a.id} article={a} variant="list" heading="h2" />
          ))}
          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-8 flex justify-between text-sm font-semibold"
            >
              {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : <span />}
              {page < totalPages && <Link href={href(page + 1)}>Next →</Link>}
            </nav>
          )}
        </section>
      )}
      {q.length >= 2 && !data && (
        <p className="mt-8 text-slate">Search is unavailable right now. Please try again.</p>
      )}
    </div>
  );
}
