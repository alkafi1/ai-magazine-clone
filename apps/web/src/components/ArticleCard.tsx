import Link from 'next/link';
import { formatDate } from '@/lib/format';
import type { Article } from '@/lib/types';
import { Cover } from './Cover';

type Variant = 'hero' | 'large' | 'small' | 'list';

function Meta({ a, light = false }: { a: Article; light?: boolean }) {
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 text-xs ${light ? 'text-snow/75' : 'text-slate'}`}
    >
      {a.category && (
        <Link
          href={`/category/${a.category.slug}`}
          className={`font-bold uppercase tracking-wider hover:underline ${light ? 'text-signal' : 'text-wire-dark'}`}
        >
          {a.category.name}
        </Link>
      )}
      <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
    </p>
  );
}

export function ArticleCard({
  article: a,
  variant = 'large',
  priority = false,
  heading: H = 'h3',
}: {
  article: Article;
  variant?: Variant;
  priority?: boolean;
  /** h2 when the page's h1 is the direct parent (listings, search); h3 under a section h2. */
  heading?: 'h2' | 'h3';
}) {
  const href = `/article/${a.slug}`;
  const label = a.category?.name ?? 'Synthwire';

  if (variant === 'hero') {
    return (
      <article className="group relative overflow-hidden rounded-xl bg-night text-snow">
        <Cover
          src={a.imageUrl}
          alt={a.imageAlt}
          label={label}
          priority={priority}
          sizes="(min-width: 1024px) 800px, 100vw"
          className="opacity-80 transition group-hover:opacity-95 md:aspect-[16/10]"
        />
        <div className="space-y-3 p-5 md:absolute md:inset-x-0 md:bottom-0 md:bg-gradient-to-t md:from-night md:via-night/85 md:to-transparent md:p-8 md:pt-24">
          <Meta a={a} light />
          <h2 className="font-display text-2xl font-extrabold leading-tight md:text-4xl">
            <Link href={href} className="after:absolute after:inset-0 hover:underline">
              {a.title}
            </Link>
          </h2>
          <p className="max-w-2xl text-snow/85">{a.excerpt}</p>
        </div>
      </article>
    );
  }

  if (variant === 'list') {
    return (
      <article className="group relative flex gap-4 border-b border-mist py-4">
        <div className="w-28 shrink-0 sm:w-40">
          <Cover
            src={a.imageThumbUrl ?? a.imageUrl}
            width={322}
            sizes="160px"
            alt={a.imageAlt}
            label={label}
            className="rounded-md"
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Meta a={a} />
          <H className="font-display text-lg font-bold leading-snug">
            <Link href={href} className="after:absolute after:inset-0 group-hover:text-wire-dark">
              {a.title}
            </Link>
          </H>
          <p className="line-clamp-2 hidden text-sm text-slate sm:block">{a.excerpt}</p>
        </div>
      </article>
    );
  }

  const big = variant === 'large';
  return (
    <article className="group relative flex flex-col gap-3">
      <Cover
        src={a.imageThumbUrl ?? a.imageUrl}
        width={322}
        priority={priority}
        alt={a.imageAlt}
        label={label}
        className="rounded-lg"
      />
      <Meta a={a} />
      <H className={`font-display font-bold leading-snug ${big ? 'text-xl' : 'text-base'}`}>
        <Link href={href} className="after:absolute after:inset-0 group-hover:text-wire-dark">
          {a.title}
        </Link>
      </H>
      {big && <p className="line-clamp-3 text-sm text-slate">{a.excerpt}</p>}
    </article>
  );
}
