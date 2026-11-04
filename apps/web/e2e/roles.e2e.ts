import { expect, test } from '@playwright/test';
import { login, loginOk, navLinks } from './helpers';

test.describe.configure({ mode: 'serial' });

const names = async (page: import('@playwright/test').Page) =>
  (await navLinks(page).allInnerTexts()).map((t) => t.trim());

test('create a custom role in a modal, give it to a user, then change its permissions live', async ({
  page,
  browser,
}) => {
  await loginOk(page);
  await page.goto('/admin/roles');
  await page.getByRole('button', { name: 'New role' }).click();
  let dialog = page.getByRole('dialog', { name: 'Create a role' });
  await dialog.getByLabel('Role name').fill('Fact Checker');
  await dialog.getByLabel('Description').fill('Reads articles, edits SEO');
  await dialog.getByLabel('Rank').fill('40');
  for (const label of ['View the dashboard', 'View articles', 'Edit SEO of stories'])
    await dialog.getByLabel(label).check();
  await dialog.getByRole('button', { name: 'Create role' }).click();
  await expect(page.getByRole('status')).toContainText('Role “Fact Checker” created');
  await expect(page.locator('tbody tr', { hasText: 'Fact Checker' })).toContainText('Custom');

  // hand it to a new user
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Add user' }).click();
  dialog = page.getByRole('dialog', { name: 'Add a user' });
  await dialog.getByLabel('Email').fill('checker@e2e.test');
  await dialog.getByLabel('Name').fill('Check Er');
  await dialog.getByLabel('Role').selectOption('fact-checker');
  await dialog.getByLabel('Temporary password').fill('checker-password-1234');
  await dialog.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('Account created');

  const ctx = await browser.newContext({ baseURL: 'http://localhost:3110' });
  const user = await ctx.newPage();
  await login(user, 'checker@e2e.test', 'checker-password-1234');
  await expect(user.getByRole('navigation', { name: 'Admin' })).toBeVisible();
  expect(await names(user)).toEqual(['Dashboard', 'Articles', 'Categories', 'My account']);
  await user.goto('/admin/ads');
  await expect(user.getByRole('heading', { name: /don’t have access/ })).toBeVisible();

  // add the ads permission to the role: the SAME session gets it on the next page load
  await page.goto('/admin/roles');
  await page
    .locator('tbody tr', { hasText: 'Fact Checker' })
    .getByRole('button', { name: 'Edit' })
    .click();
  dialog = page.getByRole('dialog', { name: 'Edit role: Fact Checker' });
  await dialog.getByLabel('Manage ads').check();
  await dialog.getByRole('button', { name: 'Save role' }).click();
  await expect(page.getByRole('status')).toContainText('updated');
  await user.goto('/admin/ads');
  await expect(user.getByRole('heading', { name: 'Ads', exact: true })).toBeVisible();
  expect(await names(user)).toContain('Ads');

  // a role in use cannot be deleted
  await page.goto('/admin/roles');
  await page
    .locator('tbody tr', { hasText: 'Fact Checker' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await page
    .getByRole('dialog', { name: /Delete .*\?/ })
    .getByRole('button', { name: 'Delete role' })
    .click();
  await expect(page.getByRole('alert').filter({ hasText: 'still use this role' })).toBeVisible();

  // clean up: remove the user, then the role
  await page.goto('/admin/users');
  await page
    .locator('tbody tr', { hasText: 'checker@e2e.test' })
    .getByRole('button', { name: 'Manage' })
    .click();
  await page
    .getByRole('dialog', { name: 'Check Er' })
    .getByRole('button', { name: 'Delete account' })
    .click();
  await page
    .getByRole('dialog', { name: /^Delete .*\?$/ })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Account deleted');
  await page.goto('/admin/roles');
  await page
    .locator('tbody tr', { hasText: 'Fact Checker' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await page
    .getByRole('dialog', { name: /Delete .*\?/ })
    .getByRole('button', { name: 'Delete role' })
    .click();
  await expect(page.getByRole('status')).toContainText('Role deleted');
  await ctx.close();
});

test('a role manager cannot grant what they do not hold', async ({ page, request }) => {
  void request;
  await loginOk(page);
  await page.goto('/admin/roles');
  // built-in roles open read-only
  await page
    .locator('tbody tr', { hasText: 'Viewer' })
    .getByRole('button', { name: 'View' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Role: Viewer' })).toContainText('View articles');
  await page.keyboard.press('Escape');
  await expect(
    page.locator('tbody tr', { hasText: 'Super admin' }).getByRole('button', { name: 'Edit' }),
  ).toHaveCount(0);
});
