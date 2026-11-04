import Link from 'next/link';
import { z } from 'zod';
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  Td,
  Th,
  button,
  fmtDateTime,
  inputCls,
  type Tone,
  TableScroll,
} from '@/components/admin/ui';
import { adminApi, guard } from '@/lib/admin';

type Entry = {
  id: string;
  at: string;
  actor: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
};
type List = { items: Entry[]; page: number; limit: number; total: number };
const query = z.object({
  actor: z.string().trim().max(254).optional(),
  action: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

const groups: [string, string][] = [
  ['', 'All actions'],
  ['auth.', 'Sign-ins'],
  ['user.', 'User management'],
  ['article.', 'Article changes'],
  ['settings.', 'Settings'],
  ['scrape.', 'Scraper'],
  ['subscriber', 'Subscribers'],
  ['account.', 'Own account'],
];
const tone = (a: string): Tone =>
  /failed|locked|delete|takedown/.test(a)
    ? 'red'
    : /^auth\.login$/.test(a)
      ? 'green'
      : /user\.|settings\./.test(a)
        ? 'violet'
        : 'gray';

export default async function AuditAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await guard('audit.view');
  const q = query.parse(await searchParams);
  const params = new URLSearchParams({ page: String(q.page), limit: '50' });
  if (q.actor) params.set('actor', q.actor);
  if (q.action) params.set('action', q.action);
  const data = await adminApi<List>(`/audit?${params}`);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const link = (p: number) =>
    `/admin/audit?${new URLSearchParams({ ...(q.actor ? { actor: q.actor } : {}), ...(q.action ? { action: q.action } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sign-in, permission-sensitive change and export, with who did it and from where. Entries cannot be edited."
      />
      <Card padded={false}>
        <form
          className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4"
          role="search"
        >
          <div>
            <label htmlFor="actor" className="text-xs font-medium text-slate-600">
              User
            </label>
            <input
              id="actor"
              name="actor"
              defaultValue={q.actor}
              placeholder="email contains…"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="action" className="text-xs font-medium text-slate-600">
              Type
            </label>
            <select id="action" name="action" defaultValue={q.action ?? ''} className={inputCls}>
              {groups.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <button className={button('primary')}>Filter</button>
          <Link href="/admin/audit" className={button('secondary')}>
            Reset
          </Link>
        </form>
        <TableScroll label="Audit log table">
          <table className="w-full min-w-[820px]">
            <caption className="sr-only">Audit log</caption>
            <thead className="bg-slate-50">
              <tr>
                <Th>When</Th>
                <Th>User</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Details</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap">{fmtDateTime(e.at)}</Td>
                  <Td>{e.actor ?? '—'}</Td>
                  <Td>
                    <Badge tone={tone(e.action)}>{e.action}</Badge>
                  </Td>
                  <Td className="max-w-xs break-words">{e.target ?? '—'}</Td>
                  <Td className="max-w-xs break-words font-mono text-xs text-slate-500">
                    {e.meta ? JSON.stringify(e.meta).slice(0, 160) : ''}
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{e.ip ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 && <Empty>No entries match.</Empty>}
        </TableScroll>
        {pages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm"
          >
            {q.page > 1 ? (
              <Link href={link(q.page - 1)} className={button('secondary', true)}>
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-slate-500">
              Page {q.page} of {pages}
            </span>
            {q.page < pages ? (
              <Link href={link(q.page + 1)} className={button('secondary', true)}>
                Older →
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
