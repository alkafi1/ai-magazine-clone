import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleCard } from '@/components/ArticleCard';
import { Ad } from '@/components/ads/Ad';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Cover } from '@/components/Cover';
import { JsonLd } from '@/components/JsonLd';
import { ShareButtons } from '@/components/ShareButtons';
import { SourceAttribution } from '@/components/SourceAttribution';
import { ViewBeacon } from '@/components/ViewBeacon';
import { getArticle, getRelated } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { newsArticleLd } from '@/lib/jsonld';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return { title: 'Story not found', robots: { index: false, follow: false } };
  const title = a.seo.metaTitle ?? a.title;
  const description = a.seo.metaDescription ?? a.excerpt;
  const url = `/article/${a.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: a.seo.noindex ? { index: false, follow: true } : undefined,
    authors: a.author ? [{ name: a.author.name, url: `/author/${a.author.slug}` }] : undefined,
    // Branded card from /og/<slug>; we do not re-share the source's picture.
    openGraph: {
      images: [{ url: `/og/${a.slug}`, width: 1200, height: 630, alt: a.title }],
      type: 'article',
      title,
      description,
      url,
      publishedTime: a.publishedAt,
      authors: a.author ? [a.author.name] : undefined,
      section: a.category?.name,
    },
    twitter: { card: 'summary_large_image', title, description, images: [`/og/${a.slug}`] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();
  const related = await getRelated(slug).catch(() => []);

  const crumbs = [
    { name: 'Home', path: '/' },
    ...(a.category ? [{ name: a.category.name, path: `/category/${a.category.slug}` }] : []),
    { name: a.title, path: `/article/${a.slug}` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={newsArticleLd(a)} />
      <ViewBeacon slug={a.slug} />
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs items={crumbs} />
        <article>
          <header className="space-y-4">
            {a.category && (
              <Link
                href={`/category/${a.category.slug}`}
                className="text-sm font-bold uppercase tracking-wider text-wire-dark hover:underline"
              >
                {a.category.name}
              </Link>
            )}
            <h1 className="font-display text-3xl font-extrabold leading-tight md:text-5xl">
              {a.title}
            </h1>
            <p className="text-sm text-slate">
              {a.author && (
                <>
                  Reported by{' '}
                  <Link
                    href={`/author/${a.author.slug}`}
                    className="font-semibold text-ink hover:underline"
                  >
                    {a.author.name}
                  </Link>{' '}
                  ·{' '}
                </>
              )}
              <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
            </p>
          </header>
          <figure className="mt-6">
            <Cover
              src={a.imageUrl}
              alt={a.imageAlt}
              label={a.category?.name ?? 'Synthwire'}
              priority
              sizes="(min-width: 768px) 768px, 100vw"
              className="rounded-xl"
            />
            {a.imageAlt && a.imageUrl && (
              <figcaption className="mt-2 text-xs text-slate">{a.imageAlt}</figcaption>
            )}
          </figure>
          <Ad slot="articleTop" className="mt-6" />
          <p className="mt-6 font-display text-xl leading-relaxed text-ink">{a.excerpt}</p>
          <div className="mt-8">
            <SourceAttribution url={a.sourceUrl} author={a.author?.name} />
          </div>
          <Ad slot="articleBottom" className="mt-6" />
          {a.tags.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Tags">
              {a.tags.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/tag/${t.slug}`}
                    className="rounded-full bg-mist px-3 py-1 text-sm font-semibold hover:bg-signal"
                  >
                    #{t.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 border-t border-mist pt-4">
            <ShareButtons path={`/article/${a.slug}`} title={a.title} />
          </div>
        </article>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-h" className="mt-14">
          <h2
            id="related-h"
            className="border-b-2 border-ink pb-2 font-display text-2xl font-extrabold"
          >
            More like this
          </h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.slice(0, 4).map((r) => (
              <ArticleCard key={r.id} article={r} variant="small" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
