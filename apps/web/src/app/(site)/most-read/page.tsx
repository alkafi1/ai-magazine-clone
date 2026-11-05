import type { Metadata } from 'next';
import { ArticleCard } from '@/components/ArticleCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export const revalidate = 120;
export const metadata: Metadata = {
  title: 'Most read this week',
  description: 'The most-read AI stories on Synthwire in the last 7 days.',
  alternates: { canonical: '/most-read' },
};

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export default async function MostReadPage() {
  let items: import('@/lib/types').Article[] = [];
  try {
    const res = await fetch(`${API}/api/most-read?limit=12`, {
      headers: { 'x-internal-secret': process.env.REVALIDATE_SECRET ?? '' },
      next: { revalidate: 120 },
    });
    if (res.ok) items = ((await res.json()) as { items: typeof items }).items ?? [];
  } catch {
    items = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: 'Home', path: '/' },
          { name: 'Most read', path: '/most-read' },
        ]}
      />
      <h1 className="mt-4 font-display text-4xl font-extrabold">Most read this week</h1>
      <p className="mt-2 text-slate">Ranked by views in the last 7 days.</p>
      {items.length === 0 ? (
        <p className="mt-10 rounded-xl border border-mist bg-card p-6 text-slate">
          No data yet — views are counted per visit.
        </p>
      ) : (
        <ol className="mt-8 space-y-0">
          {items.map((a) => (
            <li key={a.id} className="flex gap-4">
              <span className="font-display text-4xl font-extrabold text-signal" aria-hidden="true">
                {items.indexOf(a) + 1}
              </span>
              <div className="min-w-0 flex-1">
                <ArticleCard article={a} variant="list" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
