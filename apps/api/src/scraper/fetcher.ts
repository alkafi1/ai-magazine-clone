import axios, { AxiosError } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { RobotsChecker, robotsFromText } from './robots.js';

export class BlockedError extends Error {}
export class DisallowedError extends Error {}
export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Stop the whole run after this many 403/429 responses in a row. */
const MAX_BLOCKS = 3;

/**
 * Polite HTTP client: one request at a time, fixed delay between requests,
 * robots.txt check before every fetch, exponential backoff on 429/5xx,
 * and a hard stop on repeated 403/429.
 */
export class PoliteFetcher {
  private lastRequestAt = 0;
  private blocks = 0;
  private robots?: RobotsChecker;

  constructor(
    private readonly opts = {
      baseUrl: config.scraper.baseUrl,
      userAgent: config.scraper.userAgent,
      delayMs: config.scraper.delayMs,
      maxRetries: config.scraper.maxRetries,
      backoffBaseMs: 2000,
    },
  ) {}

  async loadRobots(): Promise<void> {
    const text = await this.request(`${this.opts.baseUrl}/robots.txt`);
    this.robots = robotsFromText(text);
  }

  isAllowed(url: string): boolean {
    if (!this.robots) throw new Error('call loadRobots() first');
    return new URL(url).origin === new URL(this.opts.baseUrl).origin && this.robots.isAllowed(url);
  }

  /** Fetch a page as text. Throws DisallowedError if robots forbids it or the host is not the source. */
  async get(url: string): Promise<string> {
    // Sitemaps are remote input: never follow a link to another host.
    if (new URL(url).origin !== new URL(this.opts.baseUrl).origin) {
      throw new DisallowedError(`refusing to fetch off-site URL ${url}`);
    }
    if (!this.isAllowed(url)) throw new DisallowedError(`robots.txt disallows ${url}`);
    return this.request(url);
  }

  private async request(url: string): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.lastRequestAt + this.opts.delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastRequestAt = Date.now();
      try {
        const res = await axios.get<string>(url, {
          headers: {
            'User-Agent': this.opts.userAgent,
            Accept: 'text/html,application/xml,text/plain',
          },
          responseType: 'text',
          timeout: 20_000,
          validateStatus: () => true,
          maxRedirects: 0, // a redirect could point off-site; treat 3xx as an error
        });
        const status = res.status;
        if (status >= 200 && status < 300) {
          this.blocks = 0;
          return res.data;
        }
        if (status === 403 || status === 429) {
          if (++this.blocks >= MAX_BLOCKS)
            throw new BlockedError(`blocked (${status}) ${MAX_BLOCKS} times in a row`);
        } else if (status < 500) {
          throw new FetchError(`HTTP ${status} for ${url}`, status); // 404 etc: no retry
        }
        if (attempt >= this.opts.maxRetries)
          throw new FetchError(`HTTP ${status} for ${url}`, status);
        await this.backoff(attempt, url, `HTTP ${status}`);
      } catch (err) {
        if (err instanceof BlockedError || err instanceof FetchError) throw err;
        const msg = err instanceof AxiosError ? err.message : String(err);
        if (attempt >= this.opts.maxRetries) throw new FetchError(`${msg} for ${url}`);
        await this.backoff(attempt, url, msg);
      }
    }
  }

  private async backoff(attempt: number, url: string, reason: string) {
    const ms = this.opts.backoffBaseMs * 2 ** attempt;
    logger.warn({ url, reason, attempt: attempt + 1, waitMs: ms }, 'retrying after backoff');
    await sleep(ms);
  }
}
