import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SCHEDULER_RETRY_DELAY_MS = '1';
process.env.SCHEDULER_RETRIES = '2';

const runScrape = vi.fn();
vi.mock('../scraper/pipeline.js', () => ({ runScrape }));
const sendAlert = vi.fn();
vi.mock('./alert.js', () => ({ sendAlert }));

const { connectDb, disconnectDb } = await import('../db/connection.js');
const { acquireLock, releaseLock } = await import('./lock.js');
const { executeRun } = await import('./runner.js');
const { revalidateWeb } = await import('./revalidate.js');
const { createApp } = await import('../http/app.js');
const { config } = await import('../config/index.js');

const summary = (over: Record<string, unknown> = {}) => ({
  runId: new mongoose.Types.ObjectId(),
  status: 'success',
  urlsFound: 1,
  created: 1,
  updated: 0,
  skipped: 0,
  failed: 0,
  newSlugs: ['a'],
  categorySlugs: ['ai-strategy'],
  aborted: false,
  ...over,
});

beforeAll(() => connectDb('mongodb://localhost:27017/aimag_test_scheduler'));
beforeEach(async () => {
  // Empty collections instead of dropping the DB: avoids rebuilding indexes for every test.
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  runScrape.mockReset();
  sendAlert.mockReset();
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});

describe('lock', () => {
  it('is exclusive until released or expired', async () => {
    const a = await acquireLock('t', 60_000);
    expect(a).toBeTruthy();
    expect(await acquireLock('t', 60_000)).toBeNull();
    await releaseLock('t', a!);
    const b = await acquireLock('t', 60_000);
    expect(b).toBeTruthy();
    await releaseLock('t', b!);
    await acquireLock('exp', -1); // already expired
    expect(await acquireLock('exp', 60_000)).toBeTruthy();
  });
});

describe('executeRun', () => {
  it('skips when another run holds the lock', async () => {
    const owner = await acquireLock('scrape', 60_000);
    expect(await executeRun({ trigger: 'cron' })).toEqual({ started: false, reason: 'locked' });
    expect(runScrape).not.toHaveBeenCalled();
    await releaseLock('scrape', owner!);
  });

  it('releases the lock after a run, even a failing one', async () => {
    runScrape.mockResolvedValue(summary());
    await executeRun({ trigger: 'cron' });
    await executeRun({ trigger: 'cron' });
    expect(runScrape).toHaveBeenCalledTimes(2);
  });

  it('retries failed runs, then alerts', async () => {
    runScrape.mockResolvedValue(summary({ status: 'failed', created: 0, failed: 1 }));
    const res = await executeRun({ trigger: 'cron' });
    expect(res).toMatchObject({ started: true, attempts: 3 });
    expect(runScrape).toHaveBeenCalledTimes(3);
    expect(sendAlert).toHaveBeenCalledOnce();
  });

  it('does not retry a block, but alerts', async () => {
    runScrape.mockResolvedValue(summary({ status: 'blocked', created: 0 }));
    await executeRun({ trigger: 'cron' });
    expect(runScrape).toHaveBeenCalledOnce();
    expect(sendAlert).toHaveBeenCalledOnce();
  });

  it('recovers when a retry succeeds, without alerting', async () => {
    runScrape
      .mockResolvedValueOnce(summary({ status: 'failed', created: 0 }))
      .mockResolvedValueOnce(summary());
    const res = await executeRun({ trigger: 'cron' });
    expect(res).toMatchObject({ attempts: 2 });
    expect(sendAlert).not.toHaveBeenCalled();
  });
});

describe('revalidateWeb', () => {
  let web: Server;
  afterAll(() => new Promise((r) => web?.close(r)));

  it('posts tags with the secret header, and tolerates failure', async () => {
    let seen: { secret?: string; body: string } | undefined;
    web = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen = { secret: req.headers['x-revalidate-secret'] as string, body };
        res.writeHead(200).end('{}');
      });
    });
    await new Promise<void>((r) => web.listen(0, r));
    (config as { webUrl: string }).webUrl =
      `http://127.0.0.1:${(web.address() as AddressInfo).port}`;

    expect(await revalidateWeb({ articleSlugs: ['a'], categorySlugs: ['c'] })).toBe(true);
    expect(seen?.secret).toBe(config.revalidateSecret);
    expect(JSON.parse(seen!.body).tags).toEqual(['home', 'category:c', 'article:a']);

    (config as { webUrl: string }).webUrl = 'http://127.0.0.1:1';
    expect(await revalidateWeb({ articleSlugs: [], categorySlugs: [] })).toBe(false);
  });
});

describe('manual trigger endpoint', () => {
  it('requires the secret, then accepts', async () => {
    runScrape.mockResolvedValue(summary());
    const app = createApp();
    await request(app).post('/api/internal/scrape-runs').expect(401);
    await request(app)
      .post('/api/internal/scrape-runs')
      .set('x-internal-secret', 'wrong')
      .expect(401);
    await request(app)
      .post('/api/internal/scrape-runs')
      .set('x-internal-secret', config.revalidateSecret)
      .expect(202);
    await request(app).get('/health').expect(200);
  });
});
