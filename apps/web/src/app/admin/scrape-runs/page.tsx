import { adminApi } from '@/lib/admin';
import { runScrapeNow } from '../actions';

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

const when = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16);
const color: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  blocked: 'bg-red-100 text-red-800',
};

export default async function RunsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ started?: string }>;
}) {
  const sp = await searchParams;
  const data = await adminApi<{ items: Run[]; total: number }>('/scrape-runs?limit=30');
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold">Scrape runs</h1>
        <form action={runScrapeNow}>
          <button className="rounded bg-wire px-4 py-2 font-bold text-white hover:bg-wire-dark">
            Run now
          </button>
        </form>
      </div>
      {sp.started && (
        <p role="status" className="mt-4 rounded bg-green-50 p-3 text-sm text-green-800">
          Run started. If another run is in progress this one is skipped. Reload in a minute to see
          results.
        </p>
      )}
      <p className="mt-2 text-sm text-slate">Scheduled every 6 hours. Runs are kept for 90 days.</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-mist bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Scrape runs</caption>
          <thead className="bg-mist/50 text-xs uppercase tracking-wide text-slate">
            <tr>
              {[
                'Started (UTC)',
                'Trigger',
                'Status',
                'Found',
                'New',
                'Updated',
                'Failed',
                'Duration',
              ].map((h) => (
                <th key={h} scope="col" className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id} className="border-t border-mist align-top">
                <td className="whitespace-nowrap p-3">{when(r.startedAt)}</td>
                <td className="p-3">{r.trigger}</td>
                <td className="p-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${color[r.status] ?? ''}`}
                  >
                    {r.status}
                  </span>
                  {r.warnings && r.warnings.length > 0 && (
                    <ul className="mt-1 max-w-xs space-y-1 text-xs text-yellow-900">
                      {r.warnings.map((w, i) => (
                        <li key={i}>⚠ {w}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="p-3">{r.urlsFound}</td>
                <td className="p-3">{r.created}</td>
                <td className="p-3">{r.updated}</td>
                <td className="p-3">
                  {r.failed}
                  {r.errors.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-wire-dark">errors</summary>
                      <ul className="mt-1 max-w-xs space-y-1 text-xs">
                        {r.errors.map((e, i) => (
                          <li key={i}>
                            <strong>{e.stage}</strong> {e.httpStatus ?? ''} {e.message}
                            <br />
                            <span className="break-all text-slate">{e.url}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
                <td className="p-3">
                  {r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : '—'}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate">
                  No runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
