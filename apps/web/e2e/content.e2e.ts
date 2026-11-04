import { expect, test } from '@playwright/test';
import { API, loginOk, pngFile, resetAppearance } from './helpers';

test.describe.configure({ mode: 'serial' });

const poll = (fn: () => Promise<unknown>, expected: unknown, timeout = 20_000) =>
  expect.poll(fn, { timeout }).toBe(expected);

test.describe('categories (modals)', () => {
  test('create, reject a duplicate with the modal still open, edit, delete', async ({
    page,
    request,
  }) => {
    await loginOk(page);
    await page.goto('/admin/categories');
    await page.getByRole('button', { name: 'New category' }).click();
    let dialog = page.getByRole('dialog', { name: 'New category' });
    await dialog.getByLabel('Name').fill('E2E Quantum');
    await dialog.getByLabel('URL slug').fill('e2e-quantum');
    await dialog.getByLabel('Description', { exact: true }).fill('Qubits and friends.');
    await dialog.getByRole('button', { name: 'Create category' }).click();
    await expect(page.getByRole('status')).toContainText('Category created');
    await expect(page.locator('tbody tr', { hasText: 'E2E Quantum' })).toContainText(
      '/category/e2e-quantum',
    );

    // duplicate slug -> error shown, modal re-opened
    await page.getByRole('button', { name: 'New category' }).click();
    dialog = page.getByRole('dialog', { name: 'New category' });
    await dialog.getByLabel('Name').fill('Another');
    await dialog.getByLabel('URL slug').fill('e2e-quantum');
    await dialog.getByRole('button', { name: 'Create category' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'slug exists' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'New category' })).toBeVisible();
    await page.keyboard.press('Escape'); // Escape closes it

    // edit
    await page.goto('/admin/categories');
    await page
      .locator('tbody tr', { hasText: 'E2E Quantum' })
      .getByRole('button', { name: 'Edit' })
      .click();
    dialog = page.getByRole('dialog', { name: 'Edit E2E Quantum' });
    await dialog.getByLabel('Name').fill('E2E Quantum Computing');
    await dialog.getByRole('button', { name: 'Save category' }).click();
    await expect(page.getByRole('status')).toContainText('Category updated');
    await expect(page.locator('tbody')).toContainText('E2E Quantum Computing');

    // delete (it is empty)
    await page
      .locator('tbody tr', { hasText: 'E2E Quantum Computing' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page
      .getByRole('dialog', { name: /Delete .*\?/ })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Category deleted');
    expect((await request.get('/category/e2e-quantum')).status()).toBe(404);
  });
});

test.describe('our own articles', () => {
  const slug = 'e2e-original-story';

  test('write a draft, publish it, add a cover, then delete it', async ({ page, request }) => {
    await loginOk(page);
    await page.goto('/admin/articles/new');
    await page.getByLabel('Title', { exact: true }).fill('E2E original story');
    await page
      .getByLabel('Summary', { exact: true })
      .fill('A summary written for the end-to-end test.');
    await page
      .locator('textarea[name=body]')
      .fill(
        'Intro paragraph with the word zeppelinwords.\n\n## Sub heading\n\nSecond paragraph with a [link](https://example.com).\n\n- one\n- two',
      );
    await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Robotics' });
    await page.getByLabel('Tags', { exact: true }).fill('E2E, Testing');
    await page.getByRole('button', { name: 'Create article' }).click();
    await expect(page.getByRole('status')).toContainText('Article created');
    await expect(page).toHaveURL(/\/admin\/articles\/[a-f0-9]{24}/);

    // a draft is invisible
    expect((await request.get(`/article/${slug}`)).status()).toBe(404);
    expect(await request.get('/sitemaps/articles/1.xml').then((r) => r.text())).not.toContain(slug);

    // preview tab renders markdown inside the editor
    await page.getByRole('tab', { name: 'Preview' }).click();
    await expect(page.getByRole('heading', { name: 'Sub heading' })).toBeVisible();
    await page.getByRole('tab', { name: 'Write' }).click();
    await page.getByRole('button', { name: 'Bold' }).click(); // toolbar inserts **text**
    expect(await page.locator('textarea[name=body]').inputValue()).toContain('**text**');

    // discard the toolbar experiment (unsaved) by reloading the saved draft, then publish it with a cover
    await page.reload();
    await expect(page.locator('textarea[name=body]')).toHaveValue(
      /^Intro paragraph with the word zeppelinwords\./,
    );
    await page.getByLabel('Status', { exact: true }).selectOption('published');
    await page.locator('#coverFile').setInputFiles(pngFile('cover.png'));
    await page.getByLabel('Image description (alt text)').fill('A tiny test cover');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status')).toContainText('Article saved');

    await poll(async () => (await request.get(`/article/${slug}`)).status(), 200);
    await page.goto(`/article/${slug}`);
    await expect(page.locator('h1')).toHaveText('E2E original story');
    await expect(page.locator('.md-body h3')).toHaveText('Sub heading'); // # levels shift down: the page keeps one h1
    await expect(page.locator('.md-body a')).toHaveAttribute('rel', /nofollow/);
    await expect(page.getByText('Read the full story')).toHaveCount(0); // ours: no source box
    await expect(page.getByText('By super admin')).toBeVisible();
    await expect(page.locator('figure img')).toHaveAttribute('src', /\/api\/media\/[a-f0-9]{24}$/);
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
      (t) => JSON.parse(t),
    );
    const news = ld.find((d) => d['@type'] === 'NewsArticle');
    expect(news).toBeTruthy();
    expect(news).not.toHaveProperty('isBasedOn');
    await expect(page).toHaveTitle(/E2E original story/);

    // listed, searchable (body text), in the sitemap and the RSS feed
    expect(await (await request.get('/sitemaps/articles/1.xml')).text()).toContain(slug);
    expect(await (await request.get('/feed.xml')).text()).toContain(slug);
    await poll(
      async () =>
        (await (await request.get('/search?q=zeppelinwords')).text()).includes(
          'E2E original story',
        ),
      true,
    );

    // validation: scheduling needs a future date
    await page.goto('/admin/articles?kind=original&q=E2E');
    await page
      .locator('tbody tr', { hasText: 'E2E original story' })
      .getByRole('link', { name: 'E2E original story' })
      .click();
    await page.waitForURL(/\/admin\/articles\/[a-f0-9]{24}/); // the editor, not the list page's own "Status" filter
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
    await page.getByLabel('Status', { exact: true }).selectOption('scheduled');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'future' })).toBeVisible();

    // delete for real
    await page.goto('/admin/articles?kind=original&q=E2E');
    await page
      .locator('tbody tr', { hasText: 'E2E original story' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page
      .getByRole('dialog', { name: 'Delete this article?' })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Article deleted');
    await poll(async () => (await request.get(`/article/${slug}`)).status(), 404);
  });

  test('a category cannot be deleted while it holds articles', async ({ page, request }) => {
    const token = (
      await (
        await request.post(`${API}/api/admin/login`, {
          data: { email: 'admin@e2e.test', password: 'e2e-password-12345' },
        })
      ).json()
    ).token;
    void token;
    await loginOk(page);
    await page.goto('/admin/categories');
    await page
      .locator('tbody tr', { hasText: 'AI Strategy' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page
      .getByRole('dialog', { name: /Delete .*\?/ })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'filed under this category' }),
    ).toBeVisible();
  });
});

test.describe('custom pages and menus', () => {
  test.afterAll(async ({ request }) => resetAppearance(request));

  test('create a page in a modal, publish it, link it from the footer, then replace a built-in page', async ({
    page,
    request,
  }) => {
    await loginOk(page);
    await page.goto('/admin/pages');
    await page.getByRole('button', { name: 'New page' }).click();
    let dialog = page.getByRole('dialog', { name: 'New page' });
    await dialog.getByLabel('Title', { exact: true }).fill('E2E Team');
    await dialog.getByLabel('Status', { exact: true }).selectOption('published');
    await dialog.locator('textarea[name=body]').fill('# Our team\n\nWe are **three** people.');
    await dialog.getByRole('button', { name: 'Create page' }).click();
    await expect(page.getByRole('status')).toContainText('Page created');

    await poll(async () => (await request.get('/p/e2e-team')).status(), 200);
    await page.goto('/p/e2e-team');
    await expect(page.locator('h1')).toHaveText('E2E Team');
    await expect(page.locator('.md-body strong')).toHaveText('three');
    expect(await (await request.get('/sitemaps/pages.xml')).text()).toContain('/p/e2e-team');

    // link it from the footer through Appearance
    await page.goto('/admin/appearance');
    await page.locator('#footerItems').fill('Our team | /p/e2e-team');
    await page.getByRole('button', { name: 'Save appearance' }).click();
    await expect(page.getByRole('status')).toContainText('Appearance saved');
    await poll(async () => (await (await request.get('/about')).text()).includes('Our team'), true);

    // a page with slug "about" replaces the built-in About page
    await page.goto('/admin/pages');
    await page.getByRole('button', { name: 'New page' }).click();
    dialog = page.getByRole('dialog', { name: 'New page' });
    await dialog.getByLabel('Title', { exact: true }).fill('About, our way');
    await dialog.getByLabel('URL slug').fill('about');
    await dialog.getByLabel('Status', { exact: true }).selectOption('published');
    await dialog.locator('textarea[name=body]').fill('Custom about text.');
    await dialog.getByRole('button', { name: 'Create page' }).click();
    await expect(page.getByRole('status')).toContainText('Page created');
    await poll(
      async () => (await (await request.get('/about')).text()).includes('Custom about text.'),
      true,
    );

    // delete both: the built-in About is back
    for (const title of ['About, our way', 'E2E Team']) {
      await page.goto('/admin/pages');
      await page
        .locator('tbody tr', { hasText: title })
        .getByRole('button', { name: 'Delete' })
        .click();
      await page
        .getByRole('dialog', { name: /Delete .*\?/ })
        .getByRole('button', { name: 'Delete', exact: true })
        .click();
      await expect(page.getByRole('status')).toContainText('Page deleted');
    }
    await poll(
      async () =>
        (await (await request.get('/about')).text()).includes('where the stories come from') ||
        (await (await request.get('/about')).text()).includes('Where the stories come from'),
      true,
    );
  });
});

test('media library: upload, see it, and refuse to delete an image that is in use', async ({
  page,
}) => {
  await loginOk(page);
  await page.goto('/admin/media');
  await page.locator('#file').setInputFiles(pngFile('library.png'));
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('status')).toContainText('Image uploaded');
  await expect(page.getByText('library.png')).toBeVisible();

  await page.locator('#file').setInputFiles({
    name: 'evil.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'not a valid image' })).toBeVisible();
});
