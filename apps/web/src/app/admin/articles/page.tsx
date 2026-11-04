import Link from 'next/link';
import { z } from 'zod';
import { adminApi } from '@/lib/admin';
import { setFeatured, setHidden, takedown } from '../actions';

type Row = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  publishedAt: string;
  sourceUrl: string;
  isHidden: boolean;
  isFeatured: boolean;
  status: string;
};
type List = { items: Row[]; page: number; limit: number; total: number };

const query = z.object({
  q: z.string().trim().max(100).optional(),
  hidden: z.enum(['true', 'false']).optional(),
  featured: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

const btn = 'rounded border border-mist px-2 py-1 text-xs font-semibold hover:bg-mist/60';

export default async function ArticlesAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = query.parse(await searchParams);
  const params = new URLSearchParams({ page: String(q.page), limit: '25' });
  for (const k of ['q', 'hidden', 'featured'] as const) if (q[k]) params.set(k, q[k]!);
  const data = await adminApi<List>(`/articles?${params}`);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const href = (page: number) => {
    const p = new URLSearchParams(params);
    p.set('page', String(page));
    p.delete('limit');
    return `/admin/articles?${p}`;
  };

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">
        Articles <span className="text-lg text-slate">({data.total})</span>
      </h1>
      <form className="mt-4 flex flex-wrap items-end gap-3" role="search">
        <div>
          <label htmlFor="q" className="block text-xs font-semibold">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q.q}
            className="rounded border border-mist px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="hidden" className="block text-xs font-semibold">
            Visibility
          </label>
          <select
            id="hidden"
            name="hidden"
            defaultValue={q.hidden ?? ''}
            className="rounded border border-mist px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="false">Visible</option>
            <option value="true">Hidden</option>
          </select>
        </div>
        <div>
          <label htmlFor="featured" className="block text-xs font-semibold">
            Featured
          </label>
          <select
            id="featured"
            name="featured"
            defaultValue={q.featured ?? ''}
            className="rounded border border-mist px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="true">Featured</option>
            <option value="false">Not featured</option>
          </select>
        </div>
        <button className="rounded bg-ink px-4 py-2 text-sm font-bold text-paper">Filter</button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-mist bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Articles</caption>
          <thead className="bg-mist/50 text-xs uppercase tracking-wide text-slate">
            <tr>
              <th scope="col" className="p-3">
                Title
              </th>
              <th scope="col" className="p-3">
                Category
              </th>
              <th scope="col" className="p-3">
                Published
              </th>
              <th scope="col" className="p-3">
                State
              </th>
              <th scope="col" className="p-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((a) => (
              <tr key={a.id} className="border-t border-mist align-top">
                <td className="max-w-md p-3">
                  <Link href={`/admin/articles/${a.id}`} className="font-semibold hover:underline">
                    {a.title}
                  </Link>
                  <div className="mt-1 text-xs">
                    <a href={`/article/${a.slug}`} className="text-wire-dark underline">
                      view
                    </a>{' '}
                    ·{' '}
                    <a
                      href={a.sourceUrl}
                      rel="noopener nofollow"
                      className="text-wire-dark underline"
                    >
                      source
                    </a>
                  </div>
                </td>
                <td className="p-3">{a.category ?? '—'}</td>
                <td className="whitespace-nowrap p-3">{a.publishedAt.slice(0, 10)}</td>
                <td className="p-3">
                  {a.isHidden ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      Hidden
                    </span>
                  ) : (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      Live
                    </span>
                  )}
                  {a.isFeatured && (
                    <span className="ml-1 rounded bg-signal/40 px-2 py-0.5 text-xs font-semibold">
                      Featured
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    <form action={setFeatured}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="value" value={String(!a.isFeatured)} />
                      <button className={btn}>{a.isFeatured ? 'Unfeature' : 'Feature'}</button>
                    </form>
                    <form action={setHidden}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="value" value={String(!a.isHidden)} />
                      <button className={btn}>{a.isHidden ? 'Restore' : 'Hide'}</button>
                    </form>
                    {!a.isHidden && (
                      <form action={takedown}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className={`${btn} text-red-700`}>Takedown</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate">
                  No articles match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-4 flex items-center justify-between text-sm font-semibold"
        >
          {q.page > 1 ? <Link href={href(q.page - 1)}>← Previous</Link> : <span />}
          <span className="text-slate">
            Page {q.page} of {pages}
          </span>
          {q.page < pages ? <Link href={href(q.page + 1)}>Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
