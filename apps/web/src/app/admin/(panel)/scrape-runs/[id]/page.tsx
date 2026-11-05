import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  Stat,
  TableScroll,
  Td,
  Th,
  button,
  fmtDateTime,
  type Tone,
} from '@/components/admin/ui';
import { AdminApiError, adminApi, guard } from '@/lib/admin';

type Item = {
  outcome: 'created' | 'updated' | 'failed';
  title?: string;
  slug?: string;
  url?: string;
  category?: string;
  stage?: string;
  message?: string;
  live?: boolean;
};
type Run = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  trigger: string;
  status: string;
  urlsFound: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  warnings: string[];
  notes?: string[];
  legacy: boolean;
  truncated: boolean;
  items: Item[];
  errors: { url?: string; stage: string; message: string; httpStatus?: number; at: string }[];
};
const tone: Record<string, Tone> = {
  success: 'green',
  partial: 'yellow',
  running: 'blue',
  failed: 'red',
  blocked: 'red',
};

function Articles({ items, label }: { items: Item[]; label: string }) {
  return (
    <TableScroll label={label}>
      <table className="w-full min-w-[640px]">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-slate-50">
          <tr>
            <Th>Story</Th>
            <Th>Category</Th>
            <Th>Links</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((i, n) => (
            <tr key={`${i.url}-${n}`}>
              <Td className="max-w-lg">
                <span className="font-semibold text-slate-900">{i.title}</span>
                {i.url && (
                  <span className="mt-0.5 block break-all font-mono text-[11px] text-slate-500">
                    {i.url.split('/').pop()}
                  </span>
                )}
              </Td>
              <Td>{i.category ?? '—'}</Td>
              <Td>
                <div className="flex gap-3 text-xs">
                  {i.live && i.slug && (
                    <a
                      href={`/article/${i.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="text-wire-dark hover:underline"
                    >
                      On our site
                    </a>
                  )}
                  {i.url && (
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noopener nofollow"
                      className="text-slate-500 hover:underline"
                    >
                      Original
                    </a>
                  )}
                  {!i.live && <span className="text-slate-400">not live</span>}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

export default async function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  await guard('scrape.view');
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const run = await adminApi<Run>(`/scrape-runs/${id}`).catch((e) => {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    throw e;
  });
  const created = run.items.filter((i) => i.outcome === 'created');
  const updated = run.items.filter((i) => i.outcome === 'updated');
  const failed = run.items.filter((i) => i.outcome === 'failed');

  return (
    <>
      <Link
        href="/admin/scrape-runs"
        className="text-sm font-semibold text-wire-dark hover:underline"
      >
        ← All runs
      </Link>
      <div className="mt-2" />
      <PageHeader
        title={`Run of ${fmtDateTime(run.startedAt)}`}
        description={`Started by ${run.trigger}${run.durationMs ? ` · took ${Math.round(run.durationMs / 1000)}s` : ''}. This is everything the run changed.`}
        actions={<Badge tone={tone[run.status] ?? 'gray'}>{run.status}</Badge>}
      />

      {run.warnings.length > 0 && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="font-semibold">Warnings</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {run.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {(run.notes ?? []).length > 0 && (
        <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p className="font-semibold">
            Notes{' '}
            <span className="font-normal text-sky-700">(for information, nothing to fix)</span>
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {(run.notes ?? []).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="URLs found" value={run.urlsFound} />
        <Stat
          label="New stories"
          value={run.created}
          tone={run.created ? 'green' : undefined}
          hint={run.created ? 'added' : undefined}
        />
        <Stat label="Updated" value={run.updated} />
        <Stat label="Already known" value={run.skipped} />
        <Stat
          label="Failed"
          value={run.failed}
          tone={run.failed ? 'red' : undefined}
          hint={run.failed ? 'see below' : undefined}
        />
      </div>

      <Card
        title={`New stories (${run.created})`}
        description={
          run.legacy
            ? 'This run was recorded before per-story details existed: these are the stories it last touched.'
            : 'Stories added to the site by this run.'
        }
        className="mt-6"
        padded={false}
      >
        {created.length ? (
          <Articles items={created} label="New stories" />
        ) : (
          <Empty>Nothing new in this run.</Empty>
        )}
      </Card>

      {updated.length > 0 && (
        <Card
          title={`Updated stories (${run.updated})`}
          description="Already on the site; the source changed their title, summary or picture."
          className="mt-6"
          padded={false}
        >
          <Articles items={updated} label="Updated stories" />
        </Card>
      )}

      {(failed.length > 0 || run.errors.length > 0) && (
        <Card
          title={`Problems (${Math.max(failed.length, run.errors.length)})`}
          description="Pages this run could not save, and why. They are retried on the next run."
          className="mt-6"
          padded={false}
        >
          <TableScroll label="Failed pages">
            <table className="w-full min-w-[640px]">
              <caption className="sr-only">Failed pages</caption>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Page</Th>
                  <Th>Step</Th>
                  <Th>What went wrong</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(failed.length
                  ? failed
                  : run.errors.map((e) => ({
                      outcome: 'failed' as const,
                      url: e.url,
                      stage: e.stage,
                      message: e.message,
                    }))
                ).map((f, n) => (
                  <tr key={`${f.url}-${n}`}>
                    <Td className="max-w-md break-all">
                      {f.url ? (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener nofollow"
                          className="text-wire-dark hover:underline"
                        >
                          {f.url}
                        </a>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>{f.stage ?? '—'}</Td>
                    <Td className="max-w-md break-words text-red-800">{f.message}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      )}

      {run.truncated && (
        <p className="mt-4 text-sm text-slate-500">
          Only the first 500 stories are listed; the counts above are complete.
        </p>
      )}
      <div className="mt-6">
        <Link href="/admin/scrape-runs" className={button('secondary')}>
          Back to all runs
        </Link>
      </div>
    </>
  );
}
