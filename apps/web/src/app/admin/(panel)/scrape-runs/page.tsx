import {
  Badge,
  Card,
  Empty,
  Flash,
  PageHeader,
  Td,
  Th,
  button,
  fmtDateTime,
  type Tone,
} from '@/components/admin/ui';
import { adminApi, can, guard } from '@/lib/admin';
import { runScrapeNow } from '../../actions';

type Run = {
  id: string;
  startedAt: string;
  durationMs?: number;
  trigger: string;
  status: string;
  urlsFound: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  warnings?: string[];
  errors: { url?: string; stage: string; message: string; httpStatus?: number }[];
};
const tone: Record<string, Tone> = {
  success: 'green',
  partial: 'yellow',
  running: 'blue',
  failed: 'red',
  blocked: 'red',
};

export default async function RunsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const me = await guard('scrape.view');
  const sp = await searchParams;
  const data = await adminApi<{ items: Run[]; total: number }>('/scrape-runs?limit=30');
  return (
    <>
      <PageHeader
        title="Scrape runs"
        description="The crawler runs every 6 hours. Runs are kept for 90 days. A warning means the source site may have changed shape."
        actions={
          can(me, 'scrape.run') && (
            <form action={runScrapeNow}>
              <button className={button('primary')}>Run now</button>
            </form>
          )
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <caption className="sr-only">Scrape runs</caption>
            <thead className="bg-slate-50">
              <tr>
                {[
                  'Started',
                  'Trigger',
                  'Status',
                  'Found',
                  'New',
                  'Updated',
                  'Failed',
                  'Duration',
                ].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{fmtDateTime(r.startedAt)}</Td>
                  <Td>{r.trigger}</Td>
                  <Td>
                    <Badge tone={tone[r.status] ?? 'gray'}>{r.status}</Badge>
                    {r.warnings && r.warnings.length > 0 && (
                      <ul className="mt-1.5 max-w-xs space-y-1 text-xs text-amber-800">
                        {r.warnings.map((w, i) => (
                          <li key={i}>⚠ {w}</li>
                        ))}
                      </ul>
                    )}
                  </Td>
                  <Td>{r.urlsFound}</Td>
                  <Td>{r.created}</Td>
                  <Td>{r.updated}</Td>
                  <Td>
                    {r.failed}
                    {r.errors.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-wire-dark">
                          {r.errors.length} error{r.errors.length > 1 ? 's' : ''}
                        </summary>
                        <ul className="mt-1 max-w-xs space-y-1.5 text-xs">
                          {r.errors.map((e, i) => (
                            <li key={i}>
                              <strong>{e.stage}</strong> {e.httpStatus ?? ''} {e.message}
                              <br />
                              <span className="break-all text-slate-500">{e.url}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </Td>
                  <Td>{r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 && <Empty>No runs yet.</Empty>}
        </div>
      </Card>
    </>
  );
}
