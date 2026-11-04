import type { Metadata } from 'next';
import { ArticleCard } from '@/components/ArticleCard';
import { Trending } from '@/components/Trending';
import { getHome } from '@/lib/api';
import { SITE } from '@/lib/site';
import Link from 'next/link';

export const revalidate = 120;

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
  description: SITE.description,
  alternates: { canonical: '/' },
  openGraph: { title: `${SITE.name} — ${SITE.tagline}`, description: SITE.description, url: '/' },
};

export default async function HomePage() {
  const data = await getHome().catch(() => null);

  if (!data || !data.hero) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-extrabold">Fresh headlines are on the way</h1>
        <p className="mt-3 text-slate">
          We’re collecting the latest AI stories. Please check back shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="sr-only">{SITE.name}: latest artificial intelligence news</h1>

      <section aria-label="Top stories" className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <ArticleCard article={data.hero} variant="hero" priority />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          {data.featured.slice(0, 3).map((a) => (
            <ArticleCard key={a.id} article={a} variant="small" />
          ))}
        </div>
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-12">
        <section aria-labelledby="latest-h" className="lg:col-span-8">
          <div className="flex items-end justify-between border-b-2 border-ink pb-2">
            <h2 id="latest-h" className="font-display text-2xl font-extrabold">
              Latest
            </h2>
            <Link href="/latest" className="text-sm font-semibold text-wire-dark hover:underline">
              All stories →
            </Link>
          </div>
          {data.latest.map((a) => (
            <ArticleCard key={a.id} article={a} variant="list" />
          ))}
        </section>
        <aside className="space-y-8 lg:col-span-4">
          <Trending items={data.trending} />
        </aside>
      </div>

      {data.sections.map((s) => (
        <section key={s.category.slug} aria-labelledby={`sec-${s.category.slug}`} className="mt-14">
          <div className="flex items-end justify-between border-b-2 border-ink pb-2">
            <h2 id={`sec-${s.category.slug}`} className="font-display text-2xl font-extrabold">
              {s.category.name}
            </h2>
            <Link
              href={`/category/${s.category.slug}`}
              className="text-sm font-semibold text-wire-dark hover:underline"
            >
              More {s.category.name} →
            </Link>
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {s.items.map((a) => (
              <ArticleCard key={a.id} article={a} variant="small" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
