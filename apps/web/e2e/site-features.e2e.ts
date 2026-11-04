import { expect, test } from '@playwright/test';
import { loginOk, watchErrors } from './helpers';

test.describe('public features', () => {
  test('topics page, category RSS and ads.txt', async ({ page, request }) => {
    await page.goto('/topics');
    await expect(page.getByRole('heading', { name: 'All topics' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Robotics' }).first()).toBeVisible();
    const rss = await request.get('/category/robotics/feed.xml');
    expect(rss.status()).toBe(200);
    const xml = await rss.text();
    expect(xml).toContain('<title>Robotics | Synthwire</title>');
    expect(xml).toContain('http://localhost:3110/article/robot-story-');
    expect((await request.get('/category/nope/feed.xml')).status()).toBe(404);
    expect((await request.get('/ads.txt')).status()).toBe(404); // ads are off by default
    await page.goto('/category/robotics');
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
      'href',
      /category\/robotics\/feed\.xml/,
    );
  });

  test('dark mode: toggle, persists across reload, no flash of light theme', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      false,
    );
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      true,
    );
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      true,
    );
    // the page background really is dark
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(11, 16, 32)');
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
  });

  test('copy-link button copies the article URL', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/article/strategy-sovereign-ai');
    await page.getByRole('button', { name: /Copy link/ }).click();
    await expect(page.getByRole('button', { name: /Copied/ })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'http://localhost:3110/article/strategy-sovereign-ai',
    );
  });
});

test.describe('admin-controlled site settings reach the public site', () => {
  test.describe.configure({ mode: 'serial' });

  test('announcement bar, social links, footer note', async ({ page, browser }) => {
    await loginOk(page);
    await page.goto('/admin/settings');
    await page.check('input[name=ann_enabled]');
    await page.fill('#ann_text', 'Scheduled maintenance tonight');
    await page.fill('#ann_href', '/topics');
    await page.selectOption('#ann_tone', 'warning');
    await page.fill('#social_x', 'https://x.com/synthwire_e2e');
    await page.fill('#footerNote', 'Footer note from the admin');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('status')).toContainText('Site settings saved');

    const visitor = await (
      await browser.newContext({ baseURL: 'http://localhost:3110' })
    ).newPage();
    await expect
      .poll(
        async () => {
          await visitor.goto('/about');
          return visitor.getByRole('region', { name: 'Announcement' }).isVisible();
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    await expect(visitor.getByRole('region', { name: 'Announcement' })).toContainText(
      'Scheduled maintenance tonight',
    );
    await expect(visitor.getByRole('link', { name: 'X', exact: true })).toHaveAttribute(
      'href',
      'https://x.com/synthwire_e2e',
    );
    await expect(visitor.getByText('Footer note from the admin')).toBeVisible();

    // turn it off again
    await page.goto('/admin/settings');
    await page.uncheck('input[name=ann_enabled]');
    await page.fill('#social_x', '');
    await page.fill('#footerNote', '');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('status')).toContainText('Site settings saved');
    await expect
      .poll(
        async () => {
          await visitor.goto('/about');
          return visitor.getByRole('region', { name: 'Announcement' }).count();
        },
        { timeout: 20_000 },
      )
      .toBe(0);
  });

  test('ads: appear only after consent, honour decline, extend the CSP, and publish ads.txt', async ({
    page,
    browser,
    request,
  }) => {
    await loginOk(page);
    await page.goto('/admin/ads');
    await page.check('input[name=enabled]');
    await page.check('input[name=provider][value=custom]');
    await page.check('input[name=p_headerBanner_enabled]');
    await page.fill('#p_headerBanner_html', '<div id="e2e-ad" style="height:90px">E2E AD</div>');
    await page.fill('#scriptHosts', 'https://ads.e2e-network.test');
    await page.fill('#adsTxt', 'adnetwork.test, 12345, DIRECT, abcdef');
    await page.getByRole('button', { name: 'Save ad settings' }).click();
    await expect(page.getByRole('status')).toContainText('Ad settings saved');

    const accept = await (await browser.newContext({ baseURL: 'http://localhost:3110' })).newPage();
    const errors = watchErrors(accept);
    await expect
      .poll(
        async () => {
          await accept.goto('/about');
          return accept.getByRole('dialog', { name: 'Cookie consent' }).isVisible();
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    await expect(accept.locator('#e2e-ad')).toHaveCount(0); // nothing before consent
    await accept.getByRole('button', { name: 'Accept' }).click();
    await expect(accept.locator('#e2e-ad')).toBeVisible();
    await expect(accept.getByText('Advertisement', { exact: true }).first()).toBeVisible();
    await accept.reload(); // choice is remembered
    await expect(accept.locator('#e2e-ad')).toBeVisible();
    await expect(accept.getByRole('dialog', { name: 'Cookie consent' })).toHaveCount(0);
    expect(errors).toEqual([]);

    // "Cookie settings" in the footer lets the visitor change their mind
    await accept.getByRole('button', { name: 'Cookie settings' }).click();
    await accept.getByRole('button', { name: 'Decline' }).click();
    await expect(accept.locator('#e2e-ad')).toHaveCount(0);

    const decline = await (
      await browser.newContext({ baseURL: 'http://localhost:3110' })
    ).newPage();
    await decline.goto('/about');
    await decline.getByRole('button', { name: 'Decline' }).click();
    await decline.reload();
    await expect(decline.locator('#e2e-ad')).toHaveCount(0);
    await expect(decline.locator('main')).toBeVisible(); // site works normally without ads

    // The admin-listed ad network is allowed by the CSP (proxy caches config for ~10 s).
    await expect
      .poll(async () => (await request.get('/about')).headers()['content-security-policy'] ?? '', {
        timeout: 25_000,
      })
      .toContain('https://ads.e2e-network.test');
    const ads = await request.get('/ads.txt');
    expect(ads.status()).toBe(200);
    expect(await ads.text()).toContain('adnetwork.test, 12345, DIRECT, abcdef');

    // switch ads off again
    await page.goto('/admin/ads');
    await page.uncheck('input[name=enabled]');
    await page.fill('#scriptHosts', '');
    await page.fill('#adsTxt', '');
    await page.getByRole('button', { name: 'Save ad settings' }).click();
    await expect(page.getByRole('status')).toContainText('Ad settings saved');
    await expect
      .poll(async () => (await request.get('/ads.txt')).status(), { timeout: 25_000 })
      .toBe(404);
  });

  test('the ads form refuses invalid values with a readable message', async ({ page }) => {
    await loginOk(page);
    await page.goto('/admin/ads');
    await page.fill('#adsenseClientId', 'not-an-id');
    await page.getByRole('button', { name: 'Save ad settings' }).click();
    await expect(page.locator('main [role=alert]')).toContainText('adsenseClientId');
    await page.goto('/admin/ads');
    await page.fill('#adsenseClientId', '');
    await page.fill('#scriptHosts', 'http://insecure.example');
    await page.getByRole('button', { name: 'Save ad settings' }).click();
    await expect(page.locator('main [role=alert]')).toContainText('https origin');
  });

  test('GA4 loads only after consent', async ({ page, browser }) => {
    await loginOk(page);
    await page.goto('/admin/settings');
    await page.fill('#ga4Id', 'G-E2ETEST123');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('status')).toContainText('Site settings saved');

    const v = await (await browser.newContext({ baseURL: 'http://localhost:3110' })).newPage();
    await expect
      .poll(
        async () => {
          await v.goto('/about');
          return v.getByRole('dialog', { name: 'Cookie consent' }).isVisible();
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    await expect(v.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
    await v.getByRole('button', { name: 'Accept' }).click();
    await expect(
      v.locator('script[src*="googletagmanager.com/gtag/js?id=G-E2ETEST123"]'),
    ).toHaveCount(1);

    await page.goto('/admin/settings');
    await page.fill('#ga4Id', '');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('status')).toContainText('Site settings saved');
  });
});
