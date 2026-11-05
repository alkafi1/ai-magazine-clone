import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleCard } from '@/components/ArticleCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getBranding } from '@/lib/api';

export const revalidate = 300;

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'x-internal-secret': process.env.REVALIDATE_SECRET ?? '' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type Digest = {
  date: string;
  items: import('@/lib/types').Article[];
  sections: { slug: string; items: import('@/lib/types').Article[] }[];
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const b = await getBranding();
  const date = sp.date ?? new Date().toISOString().slice(0, 10);
  return {
    title: `Daily AI Digest — ${date} | ${b.name}`,
    description: `The day's most important AI stories, expanded summaries and key points, curated by ${b.name}.`,
    alternates: { canonical: `/digest${sp.date ? `?date=${sp.date}` : ''}` },
  };
}

export default async function DigestPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = sp.date ?? today;
  const data = await fetchJson<Digest>(`/api/digest?date=${encodeURIComponent(date)}`);
  const items = data?.items ?? [];

  const prev = new Date(date);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  const prevStr = prev.toISOString().slice(0, 10);
  const nextStr = next.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: 'Home', path: '/' },
          { name: 'Daily Digest', path: '/digest' },
        ]}
      />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-extrabold">Daily AI Digest</h1>
          <p className="mt-1 text-slate">
            {date} — {items.length} stories with our expanded summaries and key points.
          </p>
        </div>
        <div className="flex gap-2 text-sm font-semibold">
          <Link
            href={`/digest?date=${prevStr}`}
            className="rounded border border-mist px-3 py-1.5 hover:bg-mist/60"
          >
            ← Previous day
          </Link>
          <Link
            href={`/digest?date=${nextStr}`}
            className="rounded border border-mist px-3 py-1.5 hover:bg-mist/60"
          >
            Next day →
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-10 rounded-xl border border-mist bg-card p-6 text-slate">
          No stories for {date} yet. Check back after the next scrape (every 6 hours).
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <ArticleCard key={a.id} article={a} variant="small" />
          ))}
        </div>
      )}
    </div>
  );
}
