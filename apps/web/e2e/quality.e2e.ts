import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginOk } from './helpers';

/**
 * Site-wide health check: every page we ship must load cleanly, have no console errors or failed
 * requests, link only to things that exist, and pass automated accessibility checks (WCAG 2 A/AA).
 */
const PUBLIC_PAGES = [
  '/',
  '/latest',
  '/topics',
  '/category/robotics',
  '/category/robotics/page/2',
  '/article/strategy-sovereign-ai',
  '/author/ada-example',
  '/search?q=robot',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/dmca',
];
const ADMIN_PAGES = [
  '/admin',
  '/admin/articles',
  '/admin/articles?q=drug',
  '/admin/scrape-runs',
  '/admin/subscribers',
  '/admin/ads',
  '/admin/settings',
  '/admin/users',
  '/admin/roles',
  '/admin/categories',
  '/admin/pages',
  '/admin/media',
  '/admin/appearance',
  '/admin/articles/new',
  '/admin/audit',
  '/admin/account',
];

/** Loads a page and returns problems found: console errors, bad responses, a11y violations. */
async function inspect(page: Page, path: string, opts: { axe?: boolean } = {}) {
  const problems: string[] = [];
  const onConsole = (m: import('@playwright/test').ConsoleMessage) => {
    // Hotlinked source images are not available in the isolated test environment; that is not a site bug.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
      problems.push(`console: ${m.text().slice(0, 200)}`);
  };
  const onResponse = (r: import('@playwright/test').Response) => {
    if (r.status() >= 400 && new URL(r.url()).origin === 'http://localhost:3110')
      problems.push(`HTTP ${r.status()}: ${r.url()}`);
  };
  page.on('console', onConsole);
  page.on('pageerror', (e) => problems.push(`exception: ${String(e).slice(0, 200)}`));
  page.on('response', onResponse);
  const res = await page.goto(path, { waitUntil: 'networkidle' });
  if (!res || res.status() >= 400) problems.push(`page status ${res?.status()}`);
  if ((opts.axe ?? true) && !problems.length) {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    for (const v of result.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )) {
      problems.push(
        `a11y ${v.impact} ${v.id}: ${v.help} (${v.nodes.length}x) e.g. ${v.nodes[0]?.target.join(' ')}`,
      );
    }
  }
  page.off('console', onConsole);
  page.off('response', onResponse);
  return problems;
}

test.describe('public pages', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} is clean (light)`, async ({ page }) => {
      expect(await inspect(page, path)).toEqual([]);
    });
  }
  for (const path of [
    '/',
    '/topics',
    '/category/robotics',
    '/article/strategy-sovereign-ai',
    '/about',
  ]) {
    test(`${path} is clean (dark: contrast is checked here)`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('sw_theme', 'dark'));
      expect(await inspect(page, path)).toEqual([]);
    });
  }
  test('404 and 410 pages are clean', async ({ page }) => {
    for (const path of ['/article/no-such-story', '/article/hidden-story']) {
      const problems = (await inspect(page, path)).filter(
        (p) => !p.startsWith('page status') && !p.startsWith('HTTP 40') && !p.startsWith('HTTP 41'),
      );
      expect(problems).toEqual([]);
    }
  });
});

test('every internal link on every public page resolves', async ({ page, request }) => {
  const seen = new Set<string>();
  const broken: string[] = [];
  for (const path of PUBLIC_PAGES) {
    await page.goto(path);
    const hrefs = await page.$$eval('a[href]', (as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    for (const href of hrefs) {
      if (
        !href.startsWith('/') ||
        href.startsWith('//') ||
        href.startsWith('/admin') ||
        seen.has(href)
      )
        continue;
      seen.add(href);
      const res = await request.get(href, { maxRedirects: 5 });
      if (res.status() >= 400) broken.push(`${res.status()} ${href} (linked from ${path})`);
    }
  }
  expect(seen.size).toBeGreaterThan(20); // sanity: the crawl actually found links
  expect(broken).toEqual([]);
});

test.describe('admin pages', () => {
  test('every admin page is clean for a super admin', async ({ page }) => {
    await loginOk(page);
    const all: string[] = [];
    for (const path of ADMIN_PAGES) {
      for (const p of await inspect(page, path)) all.push(`${path} -> ${p}`);
    }
    expect(all).toEqual([]);
  });

  test('a user with a narrower role sees clean pages too', async ({ page }) => {
    await loginOk(page, 'editor@e2e.test');
    const all: string[] = [];
    for (const path of [
      '/admin',
      '/admin/articles',
      '/admin/scrape-runs',
      '/admin/forbidden',
      '/admin/account',
    ]) {
      for (const p of await inspect(page, path)) all.push(`${path} -> ${p}`);
    }
    expect(all).toEqual([]);
  });
});
