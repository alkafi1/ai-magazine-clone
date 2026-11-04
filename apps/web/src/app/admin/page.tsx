import { adminApi } from '@/lib/admin';

type Stats = {
  articles: number;
  hidden: number;
  featured: number;
  categories: number;
  scrapedLast24h: number;
  subscribers: number;
  lastRun: {
    startedAt: string;
    status: string;
    created: number;
    updated: number;
    failed: number;
    trigger: string;
  } | null;
  topCategories: { name: string; count: number }[];
};

const when = (iso: string) => new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-mist bg-card p-4">
      <p className="text-sm text-slate">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold">{value.toLocaleString('en-GB')}</p>
    </div>
  );
}

export default async function Dashboard() {
  const s = await adminApi<Stats>('/stats');
  const max = Math.max(1, ...s.topCategories.map((c) => c.count));
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Dashboard</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Articles" value={s.articles} />
        <Tile label="Imported (24h)" value={s.scrapedLast24h} />
        <Tile label="Hidden" value={s.hidden} />
        <Tile label="Featured" value={s.featured} />
        <Tile label="Categories" value={s.categories} />
        <Tile label="Subscribers" value={s.subscribers} />
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="last-run" className="rounded-xl border border-mist bg-card p-5">
          <h2 id="last-run" className="font-display text-xl font-bold">
            Last scrape run
          </h2>
          {s.lastRun ? (
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-slate">Started</dt>
              <dd>{when(s.lastRun.startedAt)}</dd>
              <dt className="text-slate">Status</dt>
              <dd className="font-semibold">{s.lastRun.status}</dd>
              <dt className="text-slate">Trigger</dt>
              <dd>{s.lastRun.trigger}</dd>
              <dt className="text-slate">New / updated</dt>
              <dd>
                {s.lastRun.created} / {s.lastRun.updated}
              </dd>
              <dt className="text-slate">Failed</dt>
              <dd>{s.lastRun.failed}</dd>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate">No runs yet.</p>
          )}
        </section>
        <section aria-labelledby="by-cat" className="rounded-xl border border-mist bg-card p-5">
          <h2 id="by-cat" className="font-display text-xl font-bold">
            Articles by category
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {s.topCategories.map((c) => (
              <li key={c.name}>
                <div className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="font-semibold">{c.count}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-mist">
                  <div
                    className="h-2 rounded bg-wire"
                    style={{ width: `${(c.count / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
