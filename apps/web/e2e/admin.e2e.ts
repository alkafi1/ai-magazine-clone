import { expect, test } from '@playwright/test';
import { API, loginOk } from './helpers';

// One serial flow: it edits shared data and restores it at the end.
test.describe.configure({ mode: 'serial' });

test('admin area is closed to visitors and noindex', async ({ page, request }) => {
  for (const path of ['/admin', '/admin/articles', '/admin/scrape-runs', '/admin/users']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login/);
  }
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  expect((await request.get(`${API}/api/admin/stats`)).status()).toBe(401);
});

test('bad credentials are rejected without revealing which field was wrong', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('#email', 'admin@e2e.test');
  await page.fill('#password', 'wrong-password');
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL(/error=1/);
  await expect(page.locator('main [role=alert]')).toHaveText('Invalid email or password.');
});

test('login sets a locked-down session cookie and shows the dashboard', async ({
  page,
  context,
}) => {
  await loginOk(page);
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  const cookie = (await context.cookies()).find((c) => c.name === 'admin_token');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/admin' });
  expect(await page.evaluate(() => document.cookie)).toBe('');
});

test('moderation: feature, hide (public 410), restore', async ({ page, request }) => {
  await loginOk(page);
  await page.goto('/admin/articles?q=drug');
  const row = () => page.locator('tbody tr').first();
  await expect(row()).toContainText('Drug discovery');

  await row().getByRole('button', { name: 'Feature', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('featured');
  await row().getByRole('button', { name: 'Unfeature' }).click();
  await expect(row().getByRole('button', { name: 'Feature', exact: true })).toBeVisible();

  await row().getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(row().getByRole('button', { name: 'Restore' })).toBeVisible();
  expect((await request.get(`${API}/api/articles/apps-drug-discovery`)).status()).toBe(410);
  await expect
    .poll(async () => (await request.get('/article/apps-drug-discovery')).status(), {
      timeout: 15_000,
    })
    .toBe(410);

  await row().getByRole('button', { name: 'Restore' }).click();
  await expect(row().getByRole('button', { name: 'Hide', exact: true })).toBeVisible();
  await expect
    .poll(async () => (await request.get('/article/apps-drug-discovery')).status(), {
      timeout: 15_000,
    })
    .toBe(200);
});

test('takedown asks for confirmation first', async ({ page, request }) => {
  await loginOk(page);
  await page.goto('/admin/articles?q=drug');
  await page.locator('tbody tr').first().getByRole('button', { name: 'Takedown' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Take this story down?');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect((await request.get(`${API}/api/articles/apps-drug-discovery`)).status()).toBe(200); // nothing happened

  await page.locator('tbody tr').first().getByRole('button', { name: 'Takedown' }).click();
  await dialog.getByRole('button', { name: 'Take down' }).click();
  await expect(page.getByRole('status')).toContainText('taken down');
  expect((await request.get(`${API}/api/articles/apps-drug-discovery`)).status()).toBe(410);
  // put it back
  await page.locator('tbody tr').first().getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByRole('status')).toContainText('restored');
});

test('bulk actions: select rows, hide them, restore them', async ({ page }) => {
  await loginOk(page);
  await page.goto('/admin/articles?q=robot');
  await page.getByLabel('Select Robot story number 1', { exact: true }).check();
  await page.getByLabel('Select Robot story number 2', { exact: true }).check();
  await page.locator('#bulk-form button[value=hide]').click();
  await expect(page.getByRole('status')).toContainText('2 stories updated');
  await expect(page.locator('tbody tr', { hasText: 'Robot story number 1' }).first()).toContainText(
    'Hidden',
  );

  await page.getByLabel('Select Robot story number 1', { exact: true }).check();
  await page.getByLabel('Select Robot story number 2', { exact: true }).check();
  await page.locator('#bulk-form button[value=restore]').click();
  await expect(page.getByRole('status')).toContainText('2 stories updated');

  // nothing selected -> a clear message, not a silent no-op
  await page.locator('#bulk-form button[value=hide]').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Select at least one' })).toBeVisible();
});

test('SEO override flows through API revalidation to the public page, then is reverted', async ({
  page,
  request,
}) => {
  await loginOk(page);
  await page.goto('/admin/articles?q=drug');
  await page.locator('tbody tr').first().getByRole('link').first().click();
  await expect(page.locator('h1')).toContainText('Drug discovery');

  await page.fill('#metaTitle', 'Custom e2e title');
  await page.fill('#metaDescription', 'Custom e2e description');
  await page.check('input[name=noindex]');
  await page.click('button:has-text("Save SEO settings")');
  await expect(page.getByRole('status')).toContainText('SEO settings saved');

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
  );

  await page.fill('#metaTitle', '');
  await page.fill('#metaDescription', '');
  await page.uncheck('input[name=noindex]');
  await page.click('button:has-text("Save SEO settings")');
  await expect(page.getByRole('status')).toContainText('SEO settings saved');
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

test('scrape runs page, manual run, subscribers and sign-out', async ({ page }) => {
  await loginOk(page);
  await page.goto('/admin/scrape-runs');
  await expect(page.getByRole('heading', { name: 'Scrape runs' })).toBeVisible();
  await page.getByRole('button', { name: 'Run now' }).click();
  await expect(page.getByRole('status')).toContainText('Run started');

  await page.goto('/admin/subscribers');
  await expect(page.getByRole('heading', { name: 'Subscribers' })).toBeVisible();
  const csv = await page.request.get('/admin/subscribers/export');
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/admin/articles');
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await page.request.get('/admin/subscribers/export', { maxRedirects: 0 })).status()).toBe(
    307,
  ); // not signed in
});
