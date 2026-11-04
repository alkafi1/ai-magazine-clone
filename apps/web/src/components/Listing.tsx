import type { Article } from '@/lib/types';
import { Ad, inFeedEvery } from './ads/Ad';
import { ArticleCard } from './ArticleCard';
import { Breadcrumbs } from './Breadcrumbs';
import { Pagination } from './Pagination';

/** Shared layout for category / tag / author / latest pages. */
export async function Listing({
  title,
  intro,
  crumbs,
  items,
  base,
  page,
  totalPages,
}: {
  title: string;
  intro?: string | null;
  crumbs: { name: string; path: string }[];
  items: Article[];
  base: string;
  page: number;
  totalPages: number;
}) {
  const every = await inFeedEvery();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs items={crumbs} />
      <h1 className="font-display text-4xl font-extrabold">{title}</h1>
      {intro && <p className="mt-2 max-w-2xl text-slate">{intro}</p>}
      {items.length === 0 ? (
        <p className="mt-10 text-slate">No stories here yet.</p>
      ) : (
        <>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {items.flatMap((a, i) => [
              <ArticleCard
                key={a.id}
                article={a}
                variant="large"
                heading="h2"
                priority={page === 1 && i < 2}
              />,
              every > 0 && (i + 1) % every === 0 && i < items.length - 1 ? (
                <div key={`ad-${a.id}`} className="col-span-full">
                  <Ad slot="inFeed" />
                </div>
              ) : null,
            ])}
          </div>
          <Pagination base={base} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
