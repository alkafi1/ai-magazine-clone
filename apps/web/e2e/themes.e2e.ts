import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { API, apiToken, loginOk, pngFile, resetAppearance, watchErrors } from './helpers';

test.describe.configure({ mode: 'serial' });
test.afterAll(async ({ request }) => resetAppearance(request));

const poll = (fn: () => Promise<unknown>, expected: unknown, timeout = 25_000) =>
  expect.poll(fn, { timeout }).toBe(expected);

test('switch theme, rename the site and upload a logo from the admin', async ({
  page,
  browser,
  request,
}) => {
  await loginOk(page);
  await page.goto('/admin/appearance');
  await page.locator('input[name=theme][value=broadsheet]').check({ force: true });
  await page.locator('#name').fill('E2E Gazette');
  await page.locator('#tagline').fill('All the news that fits');
  await page.locator('#logoMediaIdFile').setInputFiles(pngFile('gazette.png'));
  await page.locator('input[name=headerMode][value=custom]').check();
  await page
    .locator('#headerItems')
    .fill('Home | /\nOur topics | /topics\nPartner | https://partner.example/x');
  await page.getByRole('button', { name: 'Save appearance' }).click();
  await expect(page.getByRole('status')).toContainText('Appearance saved');

  const v = await (await browser.newContext({ baseURL: 'http://localhost:3110' })).newPage();
  const errors = watchErrors(v);
  await poll(async () => {
    await v.goto('/');
    return v.locator('html').getAttribute('data-theme');
  }, 'broadsheet');
  await expect(v).toHaveTitle(/E2E Gazette/);
  await expect(v.locator('header img[src*="/api/media/"]').first()).toBeVisible(); // uploaded logo in the masthead
  await expect(v.getByText('All the news that fits').first()).toBeVisible();
  const nav = v.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Our topics' })).toHaveAttribute('href', '/topics');
  await expect(nav.getByRole('link', { name: 'Partner' })).toHaveAttribute('target', '_blank');
  await expect(nav.getByRole('link', { name: 'Robotics' })).toHaveCount(0); // custom menu replaces the automatic one
  expect(await v.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    'rgb(244, 239, 227)',
  ); // newsprint
  expect(await (await request.get('/feed.xml')).text()).toContain('<title>E2E Gazette</title>');
  expect(await (await request.get('/news-sitemap.xml')).text()).toContain(
    '<news:name>E2E Gazette</news:name>',
  );
  expect(errors).toEqual([]);

  // Midnight is dark-first: a first-time visitor sees the dark palette
  await page.goto('/admin/appearance');
  await page.locator('input[name=theme][value=midnight]').check({ force: true });
  await page.getByRole('button', { name: 'Save appearance' }).click();
  await expect(page.getByRole('status')).toContainText('Appearance saved');
  const fresh = await (await browser.newContext({ baseURL: 'http://localhost:3110' })).newPage();
  await poll(async () => {
    await fresh.goto('/');
    return fresh.locator('html').getAttribute('data-theme');
  }, 'midnight');
  expect(await fresh.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
    true,
  );
  expect(await fresh.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    'rgb(7, 12, 27)',
  );
  await fresh.getByRole('button', { name: 'Switch to light mode' }).click(); // and can still be switched to light
  expect(await fresh.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    'rgb(241, 247, 251)',
  );

  // back to the default look
  await resetAppearance(request);
  await poll(async () => {
    await v.goto('/');
    return v.locator('html').getAttribute('data-theme');
  }, 'synthwire');
  await expect(v).toHaveTitle(/Synthwire/);
});

test('saving appearance refuses bad menu links and unknown themes', async ({ page, request }) => {
  await loginOk(page);
  await page.goto('/admin/appearance');
  await page.locator('input[name=headerMode][value=custom]').check();
  await page.locator('#headerItems').fill('Bad | javascript:alert(1)');
  await page.getByRole('button', { name: 'Save appearance' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'must be a /path or an https URL' }),
  ).toBeVisible();
  const token = await apiToken(request, 'admin@e2e.test');
  const cur = await (
    await request.get(`${API}/api/admin/settings/appearance`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  const res = await request.put(`${API}/api/admin/settings/appearance`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { ...cur, theme: 'neon' },
  });
  expect(res.status()).toBe(400);
});

test('every theme passes accessibility checks in light and dark', async ({ browser, request }) => {
  test.setTimeout(240_000);
  const token = await apiToken(request, 'admin@e2e.test');
  const headers = { Authorization: `Bearer ${token}` };
  const cur = await (await request.get(`${API}/api/admin/settings/appearance`, { headers })).json();
  const problems: string[] = [];

  for (const theme of ['synthwire', 'broadsheet', 'midnight']) {
    await request.put(`${API}/api/admin/settings/appearance`, { headers, data: { ...cur, theme } });
    for (const mode of ['light', 'dark']) {
      const ctx = await browser.newContext({ baseURL: 'http://localhost:3110' });
      const p = await ctx.newPage();
      await p.addInitScript((m) => localStorage.setItem('sw_theme', m), mode);
      await expect
        .poll(
          async () => {
            await p.goto('/');
            return p.locator('html').getAttribute('data-theme');
          },
          { timeout: 30_000 },
        )
        .toBe(theme);
      for (const path of ['/', '/article/strategy-sovereign-ai', '/category/robotics', '/topics']) {
        await p.goto(path, { waitUntil: 'networkidle' });
        const result = await new AxeBuilder({ page: p })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        for (const v of result.violations.filter(
          (x) => x.impact === 'serious' || x.impact === 'critical',
        )) {
          problems.push(
            `${theme}/${mode} ${path}: ${v.id} (${v.nodes.length}x) ${v.nodes[0]?.target.join(' ')}`,
          );
        }
      }
      await ctx.close();
    }
  }
  await resetAppearance(request);
  expect(problems).toEqual([]);
});
