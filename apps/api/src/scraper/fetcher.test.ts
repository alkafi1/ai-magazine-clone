import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockedError, DisallowedError, PoliteFetcher } from './fetcher.js';

let server: Server;
let hits: string[] = [];

async function start(handler: (url: string, n: number) => number | string): Promise<string> {
  hits = [];
  server = createServer((req, res) => {
    hits.push(req.url ?? '');
    const out = handler(req.url ?? '', hits.length);
    if (typeof out === 'number') res.writeHead(out).end('nope');
    else res.writeHead(200).end(out);
  });
  await new Promise<void>((r) => server.listen(0, r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const make = (baseUrl: string) =>
  new PoliteFetcher({ baseUrl, userAgent: 'test', delayMs: 0, maxRetries: 2, backoffBaseMs: 1 });

afterEach(() => new Promise<void>((r) => server.close(() => r())));

describe('PoliteFetcher', () => {
  it('stops with BlockedError after 3 consecutive 429s', async () => {
    const base = await start((url) => (url === '/robots.txt' ? 'User-agent: *\n' : 429));
    const f = make(base);
    await f.loadRobots();
    await expect(f.get(`${base}/news/a`)).rejects.toBeInstanceOf(BlockedError);
    expect(hits.filter((h) => h === '/news/a')).toHaveLength(3);
  });
  it('retries 503 then succeeds', async () => {
    const base = await start((url, n) =>
      url === '/robots.txt' ? 'User-agent: *\n' : n < 3 ? 503 : '<html>ok</html>',
    );
    const f = make(base);
    await f.loadRobots();
    expect(await f.get(`${base}/news/a`)).toContain('ok');
  });
  it('refuses disallowed URLs without making a request', async () => {
    const base = await start(() => 'User-agent: *\nDisallow: /private\n');
    const f = make(base);
    await f.loadRobots();
    await expect(f.get(`${base}/private/x`)).rejects.toBeInstanceOf(DisallowedError);
    await expect(f.get(`${base}/news/a?x=1`)).rejects.toBeInstanceOf(DisallowedError);
    expect(hits).toEqual(['/robots.txt']);
  });
});
