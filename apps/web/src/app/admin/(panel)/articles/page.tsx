import Link from 'next/link';
import { z } from 'zod';
import { ConfirmButton } from '@/components/admin/ConfirmDialog';
import { SelectAll } from '@/components/admin/SelectAll';
import {
  Badge,
  Card,
  Empty,
  Flash,
  PageHeader,
  Td,
  Th,
  button,
  fmtRelative,
  inputCls,
} from '@/components/admin/ui';
import { adminApi, can, guard } from '@/lib/admin';
import { bulkArticles, setFeatured, setHidden, takedown } from '../../actions';

type Row = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  publishedAt: string;
  sourceUrl: string;
  isHidden: boolean;
  isFeatured: boolean;
  viewCount: number;
};
type List = { items: Row[]; page: number; limit: number; total: number };

const query = z.object({
  q: z.string().trim().max(100).optional(),
  hidden: z.enum(['true', 'false']).optional(),
  featured: z.enum(['true', 'false']).optional(),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,120}$/)
    .optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  ok: z.string().max(300).optional(),
  err: z.string().max(300).optional(),
});

export default async function ArticlesAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const me = await guard('articles.view');
  const q = query.parse(await searchParams);
  const params = new URLSearchParams({ page: String(q.page), limit: '25' });
  for (const k of ['q', 'hidden', 'featured', 'category'] as const) if (q[k]) params.set(k, q[k]!);
  const [data, cats] = await Promise.all([
    adminApi<List>(`/articles?${params}`),
    fetch(`${process.env.API_URL ?? 'http://localhost:4000'}/api/categories`, { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ items: { name: string; slug: string }[] }>)
      .catch(() => ({ items: [] })),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const link = (page: number) => {
    const p = new URLSearchParams(params);
    p.set('page', String(page));
    p.delete('limit');
    return `/admin/articles?${p}`;
  };
  const back = link(q.page);
  const canModerate = can(me, 'articles.moderate');
  const canFeature = can(me, 'articles.feature');
  const bulk = canModerate || canFeature;

  return (
    <>
      <PageHeader
        title="Articles"
        description={`${data.total.toLocaleString('en-GB')} stories match. Select several to act on them at once.`}
      />
      <Flash ok={q.ok} err={q.err} />

      <Card padded={false}>
        <form
          className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4"
          role="search"
        >
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="text-xs font-medium text-slate-600">
              Search title or summary
            </label>
            <input id="q" name="q" defaultValue={q.q} className={inputCls} />
          </div>
          <div>
            <label htmlFor="category" className="text-xs font-medium text-slate-600">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={q.category ?? ''}
              className={inputCls}
            >
              <option value="">All</option>
              {cats.items.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hidden" className="text-xs font-medium text-slate-600">
              Visibility
            </label>
            <select id="hidden" name="hidden" defaultValue={q.hidden ?? ''} className={inputCls}>
              <option value="">All</option>
              <option value="false">Live</option>
              <option value="true">Hidden</option>
            </select>
          </div>
          <div>
            <label htmlFor="featured" className="text-xs font-medium text-slate-600">
              Featured
            </label>
            <select
              id="featured"
              name="featured"
              defaultValue={q.featured ?? ''}
              className={inputCls}
            >
              <option value="">All</option>
              <option value="true">Featured</option>
              <option value="false">Not featured</option>
            </select>
          </div>
          <button className={button('primary')}>Filter</button>
          <Link href="/admin/articles" className={button('secondary')}>
            Reset
          </Link>
        </form>

        {bulk && (
          <form
            id="bulk-form"
            action={bulkArticles}
            className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5"
          >
            <input type="hidden" name="back" value={back} />
            <span className="mr-1 text-xs font-medium text-slate-600">With selected:</span>
            {canFeature && (
              <button name="action" value="feature" className={button('secondary', true)}>
                Feature
              </button>
            )}
            {canFeature && (
              <button name="action" value="unfeature" className={button('secondary', true)}>
                Unfeature
              </button>
            )}
            {canModerate && (
              <button name="action" value="hide" className={button('secondary', true)}>
                Hide
              </button>
            )}
            {canModerate && (
              <button name="action" value="restore" className={button('secondary', true)}>
                Restore
              </button>
            )}
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <caption className="sr-only">Articles</caption>
            <thead className="bg-slate-50">
              <tr>
                {bulk && (
                  <Th className="w-10">
                    <SelectAll form="bulk-form" />
                  </Th>
                )}
                <Th>Story</Th>
                <Th>Category</Th>
                <Th>Published</Th>
                <Th>Views</Th>
                <Th>State</Th>
                {(canModerate || canFeature) && <Th>Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  {bulk && (
                    <Td>
                      <input
                        type="checkbox"
                        name="ids"
                        value={a.id}
                        form="bulk-form"
                        aria-label={`Select ${a.title}`}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </Td>
                  )}
                  <Td className="max-w-md">
                    <Link
                      href={`/admin/articles/${a.id}`}
                      className="font-semibold text-slate-900 hover:text-wire-dark hover:underline"
                    >
                      {a.title}
                    </Link>
                    <div className="mt-1 flex gap-3 text-xs">
                      <a
                        href={`/article/${a.slug}`}
                        target="_blank"
                        rel="noopener"
                        className="text-wire-dark hover:underline"
                      >
                        View page
                      </a>
                      <a
                        href={a.sourceUrl}
                        target="_blank"
                        rel="noopener nofollow"
                        className="text-slate-500 hover:underline"
                      >
                        Original
                      </a>
                    </div>
                  </Td>
                  <Td>{a.category ?? '—'}</Td>
                  <Td className="whitespace-nowrap">
                    <span title={a.publishedAt}>{fmtRelative(a.publishedAt)}</span>
                  </Td>
                  <Td>{a.viewCount}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {a.isHidden ? (
                        <Badge tone="red">Hidden</Badge>
                      ) : (
                        <Badge tone="green">Live</Badge>
                      )}
                      {a.isFeatured && <Badge tone="yellow">Featured</Badge>}
                    </div>
                  </Td>
                  {(canModerate || canFeature) && (
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {canFeature && !a.isHidden && (
                          <form action={setFeatured}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="back" value={back} />
                            <input type="hidden" name="value" value={String(!a.isFeatured)} />
                            <button className={button('secondary', true)}>
                              {a.isFeatured ? 'Unfeature' : 'Feature'}
                            </button>
                          </form>
                        )}
                        {canModerate && (
                          <form action={setHidden}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="back" value={back} />
                            <input type="hidden" name="value" value={String(!a.isHidden)} />
                            <button className={button('secondary', true)}>
                              {a.isHidden ? 'Restore' : 'Hide'}
                            </button>
                          </form>
                        )}
                        {canModerate && !a.isHidden && (
                          <form action={takedown}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="back" value={back} />
                            <ConfirmButton
                              label="Takedown"
                              title="Take this story down?"
                              message="It disappears from the site and search results (HTTP 410) and will not be re-imported. You can restore it later."
                              confirmLabel="Take down"
                              className={button('dangerOutline', true)}
                              danger
                            />
                          </form>
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 && <Empty>No stories match these filters.</Empty>}
        </div>

        {pages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm"
          >
            {q.page > 1 ? (
              <Link href={link(q.page - 1)} className={button('secondary', true)}>
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-slate-500">
              Page {q.page} of {pages}
            </span>
            {q.page < pages ? (
              <Link href={link(q.page + 1)} className={button('secondary', true)}>
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Card>
    </>
  );
}
