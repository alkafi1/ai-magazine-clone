import Link from 'next/link';
import { z } from 'zod';
import { ConfirmButton } from '@/components/admin/ConfirmDialog';
import {
  Card,
  Empty,
  Flash,
  PageHeader,
  Td,
  Th,
  button,
  fmtDateTime,
  inputCls,
} from '@/components/admin/ui';
import { adminApi, can, guard } from '@/lib/admin';
import { deleteSubscriber } from '../../actions';

type List = {
  items: { id: string; email: string; subscribedAt: string }[];
  page: number;
  limit: number;
  total: number;
};
const query = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  ok: z.string().max(300).optional(),
  err: z.string().max(300).optional(),
});

export default async function Subscribers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const me = await guard('subscribers.view');
  const q = query.parse(await searchParams);
  const params = new URLSearchParams({ page: String(q.page), limit: '25' });
  if (q.q) params.set('q', q.q);
  const data = await adminApi<List>(`/subscribers?${params}`);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const manage = can(me, 'subscribers.manage');
  const link = (p: number) =>
    `/admin/subscribers?${new URLSearchParams({ ...(q.q ? { q: q.q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Subscribers"
        description={`${data.total.toLocaleString('en-GB')} people signed up to the newsletter. Treat this list as personal data.`}
        actions={
          manage && (
            <a href="/admin/subscribers/export" className={button('secondary')}>
              Export CSV
            </a>
          )
        }
      />
      <Flash ok={q.ok} err={q.err} />
      <Card padded={false}>
        <form className="flex gap-3 border-b border-slate-100 p-4" role="search">
          <div className="flex-1">
            <label htmlFor="q" className="sr-only">
              Search email
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q.q}
              placeholder="Search email…"
              className={inputCls}
            />
          </div>
          <button className={button('primary')}>Search</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full">
            <caption className="sr-only">Newsletter subscribers</caption>
            <thead className="bg-slate-50">
              <tr>
                <Th>Email</Th>
                <Th>Subscribed</Th>
                {manage && <Th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium text-slate-900">{s.email}</Td>
                  <Td>{fmtDateTime(s.subscribedAt)}</Td>
                  {manage && (
                    <Td className="text-right">
                      <form action={deleteSubscriber}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="back" value={link(q.page)} />
                        <ConfirmButton
                          label="Remove"
                          title="Remove this subscriber?"
                          message={`${s.email} will be deleted from the list. This cannot be undone.`}
                          confirmLabel="Remove"
                          className={button('dangerOutline', true)}
                          danger
                        />
                      </form>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 && <Empty>No subscribers found.</Empty>}
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
