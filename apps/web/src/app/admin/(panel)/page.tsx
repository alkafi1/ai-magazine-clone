import Link from 'next/link';
import { BarChart, HBars, RunStrip } from '@/components/admin/charts';
import {
  Badge,
  Card,
  PageHeader,
  Stat,
  button,
  fmtRelative,
  type Tone,
} from '@/components/admin/ui';
import { can, guard, adminApi } from '@/lib/admin';
import { runScrapeNow } from '../actions';

type Stats = {
  articles: number;
  hidden: number;
  featured: number;
  categories: number;
  scrapedLast24h: number;
  subscribers: number;
  totalViews: number;
  activeAdmins: number;
  lastRun: {
    _id: string;
    startedAt: string;
    status: string;
    created: number;
    updated: number;
    failed: number;
    warnings?: string[];
  } | null;
  daily: { date: string; count: number }[];
  recentRuns: { startedAt: string; status: string; created: number; warnings?: string[] }[];
  topCategories: { name: string; count: number }[];
};

const runTone: Record<string, Tone> = {
  success: 'green',
  partial: 'yellow',
  running: 'blue',
  failed: 'red',
  blocked: 'red',
};

export default async function Dashboard() {
  const me = await guard('dashboard.view');
  const s = await adminApi<Stats>('/stats');
  const last = s.lastRun;
  const stale = last ? Date.now() - new Date(last.startedAt).getTime() > 8 * 3600 * 1000 : true;
  const importedWeek = s.daily.slice(-7).reduce((n, d) => n + d.count, 0);

  return (
    <>
      <PageHeader
        title={`Welcome back${me.name ? `, ${me.name.split(' ')[0]}` : ''}`}
        description="Health of the site and its content pipeline at a glance."
        actions={
          can(me, 'scrape.run') && (
            <form action={runScrapeNow}>
              <button className={button('primary')}>Run scrape now</button>
            </form>
          )
        }
      />

      {(stale ||
        (last?.warnings?.length ?? 0) > 0 ||
        last?.status === 'failed' ||
        last?.status === 'blocked') && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="font-semibold">Attention needed</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {!last && <li>No scrape has run yet. Run one to import the first stories.</li>}
            {last && stale && (
              <li>
                The last scrape was {fmtRelative(last.startedAt)}; the schedule is every 6 hours.
              </li>
            )}
            {last && (last.status === 'failed' || last.status === 'blocked') && (
              <li>The last run {last.status}. Check the runs page for the error.</li>
            )}
            {last?.warnings?.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Published stories" value={s.articles - s.hidden} hint={`${s.hidden} hidden`} />
        <Stat
          label="Imported · last 24h"
          value={s.scrapedLast24h}
          hint={`${importedWeek} published this week`}
        />
        <Stat label="Total views" value={s.totalViews} />
        <Stat label="Newsletter" value={s.subscribers} hint="subscribers" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card
          title="Stories published per day"
          description="Last 30 days (by original publish date)"
          className="lg:col-span-2"
        >
          <BarChart
            data={s.daily.map((d) => ({ label: d.date, value: d.count }))}
            label="Stories published per day over the last 30 days"
          />
        </Card>
        <Card title="Scrape pipeline" description="Most recent runs, oldest to newest">
          <RunStrip runs={s.recentRuns} />
          {last && (
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Last run</dt>
                <dd>{fmtRelative(last.startedAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <Badge tone={runTone[last.status] ?? 'gray'}>{last.status}</Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">New / updated / failed</dt>
                <dd className="font-medium">
                  {last.created} / {last.updated} / {last.failed}
                </dd>
              </div>
            </dl>
          )}
          {can(me, 'scrape.view') && (
            <div className="mt-4 flex gap-4 text-sm font-semibold">
              {last && (
                <Link
                  href={`/admin/scrape-runs/${last._id}`}
                  className="text-wire-dark hover:underline"
                >
                  What did it import? →
                </Link>
              )}
              <Link href="/admin/scrape-runs" className="text-wire-dark hover:underline">
                All runs →
              </Link>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Stories by category" className="lg:col-span-2">
          <HBars data={s.topCategories} />
        </Card>
        <Card title="Content status">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Featured</dt>
              <dd className="font-semibold">{s.featured}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Hidden / taken down</dt>
              <dd className="font-semibold">{s.hidden}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Categories</dt>
              <dd className="font-semibold">{s.categories}</dd>
            </div>
            {can(me, 'users.view') && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Active admin accounts</dt>
                <dd className="font-semibold">{s.activeAdmins}</dd>
              </div>
            )}
          </dl>
          {can(me, 'articles.view') && s.hidden > 0 && (
            <Link
              href="/admin/articles?hidden=true"
              className="mt-4 inline-block text-sm font-semibold text-wire-dark hover:underline"
            >
              Review hidden stories →
            </Link>
          )}
        </Card>
      </div>
    </>
  );
}
