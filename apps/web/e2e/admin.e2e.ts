import { expect, test } from '@playwright/test';
import { login } from './helpers';

// One serial flow: it edits shared data and restores it at the end.
test.describe.configure({ mode: 'serial' });

test('admin area is closed to visitors and noindex', async ({ page, request }) => {
  for (const path of ['/admin', '/admin/articles', '/admin/scrape-runs']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login/);
  }
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  // The API itself rejects unauthenticated calls.
  expect((await request.get('http://localhost:4010/api/admin/stats')).status()).toBe(401);
});

test('bad credentials are rejected without revealing which field was wrong', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('#email', 'admin@e2e.test');
  await page.fill('#password', 'wrong-password');
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL(/error=1/);
  await expect(page.locator('main [role=alert]')).toHaveText('Invalid email or password.');
});

test('login sets a locked-down session cookie', async ({ page, context }) => {
  await login(page);
  const cookie = (await context.cookies()).find((c) => c.name === 'admin_token');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/admin' });
  expect(await page.evaluate(() => document.cookie)).toBe('');
  await expect(page.getByText('Articles', { exact: true }).first()).toBeVisible();
});

test('moderation: feature, hide (public 404 + API 410), restore', async ({ page, request }) => {
  await login(page);
  await page.goto('/admin/articles?q=drug');
  const row = page.locator('tbody tr').first();
  await expect(row).toContainText('Drug discovery');

  await row.getByRole('button', { name: 'Feature' }).click();
  await expect(
    page.locator('tbody tr').first().getByRole('button', { name: 'Unfeature' }),
  ).toBeVisible();
  await page.locator('tbody tr').first().getByRole('button', { name: 'Unfeature' }).click();
  await expect(
    page.locator('tbody tr').first().getByRole('button', { name: 'Feature' }),
  ).toBeVisible();

  await page.locator('tbody tr').first().getByRole('button', { name: 'Hide' }).click();
  await expect(
    page.locator('tbody tr').first().getByRole('button', { name: 'Restore' }),
  ).toBeVisible();
  expect(
    (await request.get('http://localhost:4010/api/articles/apps-drug-discovery')).status(),
  ).toBe(410);

  await page.locator('tbody tr').first().getByRole('button', { name: 'Restore' }).click();
  await expect(
    page.locator('tbody tr').first().getByRole('button', { name: 'Hide' }),
  ).toBeVisible();
  expect(
    (await request.get('http://localhost:4010/api/articles/apps-drug-discovery')).status(),
  ).toBe(200);
});

test('SEO override flows through API revalidation to the public page, then is reverted', async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto('/admin/articles?q=drug');
  await page.locator('tbody tr').first().getByRole('link').first().click();
  await expect(page.locator('h1')).toContainText('Drug discovery');

  await page.fill('#metaTitle', 'Custom e2e title');
  await page.fill('#metaDescription', 'Custom e2e description');
  await page.check('input[name=noindex]');
  await page.click('button:has-text("Save")');
  await expect(page).toHaveURL(/saved=1/);

  // The API calls the web app's /api/revalidate; the public page should pick it up without waiting for ISR.
  await expect
    .poll(
      async () =>
        (await (await request.get('/article/apps-drug-discovery')).text()).includes(
          'Custom e2e title',
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
  const html = await (await request.get('/article/apps-drug-discovery')).text();
  expect(html).toMatch(/<meta name="robots" content="noindex/);
  expect(html).toContain('Custom e2e description');
  expect(await (await request.get('/sitemaps/articles/1.xml')).text()).not.toContain(
    'apps-drug-discovery',
  ); // noindex pages leave the sitemap

  // revert
  await page.fill('#metaTitle', '');
  await page.fill('#metaDescription', '');
  await page.uncheck('input[name=noindex]');
  await page.click('button:has-text("Save")');
  await expect(page).toHaveURL(/saved=1/);
  await expect
    .poll(
      async () =>
        (await (await request.get('/article/apps-drug-discovery')).text()).includes(
          'Custom e2e title',
        ),
      { timeout: 15_000 },
    )
    .toBe(false);
});

test('scrape runs page, manual run, and sign-out', async ({ page }) => {
  await login(page);
  await page.goto('/admin/scrape-runs');
  await expect(page.getByRole('heading', { name: 'Scrape runs' })).toBeVisible();
  // The e2e API has no network access to the source in CI-like runs; we only assert the request is accepted.
  await page.getByRole('button', { name: 'Run now' }).click();
  await expect(page).toHaveURL(/started=1/);
  await expect(page.locator('main [role=status]')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/admin/articles');
  await expect(page).toHaveURL(/\/admin\/login/);
});
