import { expect, test } from '@playwright/test';
import { API, PASSWORD, apiToken, login, loginOk, navLinks } from './helpers';

const names = async (page: import('@playwright/test').Page) =>
  (await navLinks(page).allInnerTexts()).map((t) => t.trim());

test.describe('menus and pages follow the role', () => {
  test('editor: content tools only; cannot hide or open admin areas', async ({ page, request }) => {
    await loginOk(page, 'editor@e2e.test');
    const nav = await names(page);
    expect(nav).toEqual(
      expect.arrayContaining([
        'Dashboard',
        'Articles',
        'Categories',
        'Media',
        'Scrape runs',
        'My account',
      ]),
    );
    for (const hidden of [
      'Users',
      'Roles',
      'Audit log',
      'Ads',
      'Site settings',
      'Subscribers',
      'Appearance',
      'Pages',
    ])
      expect(nav).not.toContain(hidden);

    await page.goto('/admin/articles?q=drug');
    const row = page.locator('tbody tr').first();
    await expect(row.getByRole('button', { name: 'Feature', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Hide' })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Takedown' })).toHaveCount(0);
    await expect(page.locator('#bulk-form button[value=hide]')).toHaveCount(0);

    for (const path of [
      '/admin/users',
      '/admin/audit',
      '/admin/ads',
      '/admin/settings',
      '/admin/subscribers',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: /don’t have access/ })).toBeVisible();
    }
    // The UI hiding things is a convenience; the API is what enforces it.
    const token = await apiToken(request, 'editor@e2e.test');
    const res = await request.patch(`${API}/api/admin/articles/000000000000000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { isHidden: true },
    });
    expect(res.status()).toBe(403);
  });

  test('moderator: can hide but not feature or edit SEO', async ({ page }) => {
    await loginOk(page, 'moderator@e2e.test');
    await page.goto('/admin/articles?q=drug');
    const row = page.locator('tbody tr').first();
    await expect(row.getByRole('button', { name: 'Hide', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Feature', exact: true })).toHaveCount(0);
    await row.getByRole('link').first().click();
    await expect(page.locator('#metaTitle')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save SEO settings' })).toHaveCount(0);
  });

  test('viewer: read-only everywhere', async ({ page }) => {
    await loginOk(page, 'viewer@e2e.test');
    await page.goto('/admin/articles');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(page.locator('tbody').getByRole('button')).toHaveCount(0);
    await expect(page.locator('#bulk-form')).toHaveCount(0);
    await page.goto('/admin/scrape-runs');
    await expect(page.getByRole('button', { name: 'Run now' })).toHaveCount(0);
  });

  test('ad manager: only dashboard, ads and own account', async ({ page }) => {
    await loginOk(page, 'ad_manager@e2e.test');
    expect(await names(page)).toEqual(['Dashboard', 'Ads', 'My account']);
    await page.goto('/admin/articles');
    await expect(page.getByRole('heading', { name: /don’t have access/ })).toBeVisible();
    await page.goto('/admin/ads');
    await expect(page.getByRole('heading', { name: 'Ads', exact: true })).toBeVisible();
  });
});

test.describe('user management (serial: shares one new account)', () => {
  test.describe.configure({ mode: 'serial' });
  const email = 'newhire@e2e.test';

  test('a super admin creates an account (in a modal); it can sign in', async ({
    page,
    browser,
  }) => {
    await loginOk(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Add user' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a user' });
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('Name').fill('New Hire');
    await dialog.getByLabel('Role').selectOption('viewer');
    await dialog.getByLabel('Temporary password').fill('first-password-1234');
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('status')).toContainText(`Account created for ${email}`);
    await expect(page.locator('tbody tr', { hasText: email })).toContainText('Viewer');

    const ctx = await browser.newContext({ baseURL: 'http://localhost:3110' });
    const p = await ctx.newPage();
    await login(p, email, 'first-password-1234');
    await expect(p.getByRole('heading', { name: /Welcome back, New/ })).toBeVisible();
    await ctx.close();
  });

  test('a failed create re-opens the modal with the error beside the input', async ({ page }) => {
    await loginOk(page);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Add user' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a user' });
    await dialog.getByLabel('Email').fill(email); // already exists
    await dialog.getByLabel('Temporary password').fill('another-password-1234');
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'an account with that email exists' }),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Add a user' })).toBeVisible(); // modal came back open
  });

  test('changing the role applies to the open session immediately', async ({ page, browser }) => {
    const ctx = await browser.newContext({ baseURL: 'http://localhost:3110' });
    const hire = await ctx.newPage();
    await login(hire, email, 'first-password-1234');
    await expect(hire.getByRole('navigation', { name: 'Admin' })).toBeVisible();

    await loginOk(page);
    await page.goto('/admin/users');
    await page
      .locator('tbody tr', { hasText: email })
      .getByRole('button', { name: 'Manage' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'New Hire' });
    await dialog.locator('select[name=role]').selectOption('editor');
    await dialog.getByRole('button', { name: 'Change role' }).click();
    await expect(page.getByRole('status')).toContainText('Account updated');

    await hire.goto('/admin/articles'); // old session: its token version is stale
    await expect(hire).toHaveURL(/\/admin\/login/);
    await login(hire, email, 'first-password-1234');
    await expect(hire.getByRole('navigation', { name: 'Admin' })).toBeVisible();
    expect(await names(hire)).toContain('Articles'); // editor now
    await ctx.close();
  });

  test('disabled accounts cannot sign in; reset password and delete work', async ({
    page,
    browser,
  }) => {
    await loginOk(page);
    await page.goto('/admin/users');
    // Each action redirects back with a flash message; wait for it before the next step.
    const manage = async () => {
      await page
        .locator('tbody tr', { hasText: email })
        .getByRole('button', { name: 'Manage' })
        .click();
      return page.getByRole('dialog', { name: 'New Hire' });
    };

    let dialog = await manage();
    await dialog.getByRole('button', { name: 'Disable account' }).click();
    await expect(page.getByRole('status')).toContainText('Account updated');
    await expect(page.locator('tbody tr', { hasText: email }).getByText('Disabled')).toBeVisible();

    const ctx = await browser.newContext({ baseURL: 'http://localhost:3110' });
    const p = await ctx.newPage();
    await login(p, email, 'first-password-1234');
    await expect(p).toHaveURL(/error=1/);

    dialog = await manage();
    await dialog.getByRole('button', { name: 'Enable account' }).click();
    await expect(page.getByRole('status')).toContainText('Account updated');
    await expect(page.locator('tbody tr', { hasText: email }).getByText('Active')).toBeVisible();

    dialog = await manage();
    await dialog.getByLabel('Set a new password').fill('reset-password-5678');
    await dialog.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByRole('status')).toContainText('Password reset');
    await login(p, email, 'reset-password-5678');
    await expect(p.getByRole('navigation', { name: 'Admin' })).toBeVisible();
    await ctx.close();

    dialog = await manage();
    await dialog.getByRole('button', { name: 'Delete account' }).click();
    await page
      .getByRole('dialog', { name: /^Delete .*\?$/ })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Account deleted');
    await expect(page.locator('tbody tr', { hasText: email })).toHaveCount(0);
  });

  test('audit log recorded it, and passwords never appear', async ({ page }) => {
    await loginOk(page);
    await page.goto('/admin/audit?action=user.');
    await expect(page.locator('tbody')).toContainText('user.create');
    await expect(page.locator('tbody')).toContainText('user.delete');
    const html = await page.content();
    expect(html).not.toContain('first-password-1234');
    expect(html).not.toContain('reset-password-5678');
  });
});

test('lockout: five wrong passwords lock the account, an admin can unlock it', async ({
  page,
  browser,
}) => {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:3110' });
  const p = await ctx.newPage();
  for (let i = 0; i < 5; i++) {
    await login(p, 'lockme@e2e.test', 'wrong-password-xyz');
    await expect(p).toHaveURL(/error=1/);
  }
  await login(p, 'lockme@e2e.test', PASSWORD); // correct, but locked
  await expect(p).toHaveURL(/error=1/);

  await loginOk(page);
  await page.goto('/admin/users');
  const row = page.locator('tbody tr', { hasText: 'lockme@e2e.test' });
  await expect(row.getByText('Locked')).toBeVisible();
  await row.getByRole('button', { name: 'Manage' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('status')).toContainText('Account updated');
  await login(p, 'lockme@e2e.test', PASSWORD);
  await expect(p.getByRole('navigation', { name: 'Admin' })).toBeVisible();
  await ctx.close();
});

test('my account: wrong current password is refused; changing it keeps this session', async ({
  page,
  browser,
}) => {
  await loginOk(page, 'viewer@e2e.test');
  await page.goto('/admin/account');
  await page.fill('#current', 'not-my-password');
  await page.fill('#password', 'brand-new-password-1');
  await page.fill('#confirm', 'brand-new-password-1');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'current password is incorrect' }),
  ).toBeVisible();

  await page.fill('#current', PASSWORD);
  await page.fill('#password', 'brand-new-password-1');
  await page.fill('#confirm', 'brand-new-password-2');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'do not match' })).toBeVisible();

  await page.fill('#current', PASSWORD);
  await page.fill('#password', 'brand-new-password-1');
  await page.fill('#confirm', 'brand-new-password-1');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('status')).toContainText('Password changed');
  await page.goto('/admin'); // still signed in
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  // restore for later tests
  await page.goto('/admin/account');
  await page.fill('#current', 'brand-new-password-1');
  await page.fill('#password', PASSWORD);
  await page.fill('#confirm', PASSWORD);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('status')).toContainText('Password changed');
  void browser;
});
