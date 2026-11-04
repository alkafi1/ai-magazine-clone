import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getCategories } from '@/lib/api';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'All topics',
  description:
    'Browse AI news by topic: strategy, applications, robotics, responsible AI, start-ups and more.',
  alternates: { canonical: '/topics' },
};

export default async function Topics() {
  const cats = (await getCategories().catch(() => [])).filter((c) => c.articleCount > 0);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: 'Home', path: '/' },
          { name: 'Topics', path: '/topics' },
        ]}
      />
      <h1 className="font-display text-4xl font-extrabold">All topics</h1>
      <p className="mt-2 max-w-2xl text-slate">
        Every story is filed under one topic. Pick one to see its latest headlines, or subscribe to
        its RSS feed.
      </p>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <li
            key={c.slug}
            className="group relative rounded-xl border border-mist bg-card p-5 transition hover:border-wire"
          >
            <h2 className="font-display text-xl font-bold">
              <Link
                href={`/category/${c.slug}`}
                className="after:absolute after:inset-0 group-hover:text-wire-dark"
              >
                {c.name}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-slate">
              {c.description ?? `Latest ${c.name} news and analysis.`}
            </p>
            <p className="mt-3 flex items-center justify-between text-xs font-semibold text-slate">
              <span>
                {c.articleCount} {c.articleCount === 1 ? 'story' : 'stories'}
              </span>
              <a
                href={`/category/${c.slug}/feed.xml`}
                className="relative z-10 text-wire-dark hover:underline"
                aria-label={`RSS feed for ${c.name}`}
              >
                RSS
              </a>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
