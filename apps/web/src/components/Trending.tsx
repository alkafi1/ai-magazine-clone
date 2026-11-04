import Link from 'next/link';
import type { Article } from '@/lib/types';

export function Trending({ items }: { items: Article[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="trending-h" className="rounded-xl border border-mist bg-card p-5">
      <h2 id="trending-h" className="font-display text-xl font-extrabold">
        Trending now
      </h2>
      <ol className="mt-3 space-y-4">
        {items.map((a, i) => (
          <li key={a.id} className="flex gap-3">
            <span
              aria-hidden="true"
              className="font-display text-3xl font-extrabold leading-none text-signal"
            >
              {i + 1}
            </span>
            <Link
              href={`/article/${a.slug}`}
              className="font-semibold leading-snug hover:text-wire-dark hover:underline"
            >
              {a.title}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
