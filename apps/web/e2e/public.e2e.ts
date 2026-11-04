import { expect, test } from '@playwright/test';
import { jsonLd, meta, watchErrors } from './helpers';

test.describe('home', () => {
  test('renders hero, latest, categories and valid structured data without console errors', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/Synthwire/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('article').first()).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Robotics' }),
    ).toBeVisible();
    await expect(
      page
        .getByText('Content aggregated from AI Magazine', { exact: false })
        .or(page.getByText('aggregated from', { exact: false })),
    ).toBeVisible();
    expect((await jsonLd(page)).map((d) => d['@type']).sort()).toEqual(['Organization', 'WebSite']);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      'http://localhost:3110',
    );
    expect(errors).toEqual([]);
  });

  test('never shows hidden stories', async ({ page }) => {
    await page.goto('/latest');
    await expect(page.getByText('This story was taken down')).toHaveCount(0);
  });
});

test.describe('article page', () => {
  const path = '/article/strategy-sovereign-ai';

  test('has full SEO, links to the original and shows no article body', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await expect(page.locator('h1')).toHaveText('Sovereign AI strategy for nations');
    await expect(page).toHaveTitle('Sovereign AI strategy for nations | Synthwire');
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      `http://localhost:3110${path}`,
    );
    expect(await meta(page, '[property="og:type"]')).toBe('article');
    expect(await meta(page, '[property="og:image"]')).toBe(
      'http://localhost:3110/og/strategy-sovereign-ai',
    );
    expect(await meta(page, '[name="twitter:card"]')).toBe('summary_large_image');
    await expect(page.locator('meta[name=robots]')).toHaveCount(0); // indexable

    const types = (await jsonLd(page)).map((d) => d['@type']);
    expect(types).toEqual(
      expect.arrayContaining(['NewsArticle', 'BreadcrumbList', 'Organization', 'WebSite']),
    );
    const news = (await jsonLd(page)).find((d) => d['@type'] === 'NewsArticle')!;
    expect((news.isBasedOn as { url: string }).url).toBe(
      'https://aimagazine.com/news/strategy-sovereign-ai',
    );
    expect(news.datePublished).toBeTruthy();

    const source = page.getByRole('link', { name: /Read the full story at AI Magazine/ });
    await expect(source).toHaveAttribute(
      'href',
      'https://aimagazine.com/news/strategy-sovereign-ai',
    );
    await expect(source).toHaveAttribute('rel', /nofollow/);
    await expect(source).toHaveAttribute('rel', /noopener/);
    await expect(source).toHaveAttribute('target', '_blank');

    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('AI Strategy');
    expect(errors).toEqual([]);
  });

  test('social card image is served', async ({ request }) => {
    const res = await request.get('/og/strategy-sovereign-ai');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    expect((await request.get('/og/does-not-exist')).status()).toBe(404);
  });

  test('hidden and unknown stories render the 404 page with 404 status', async ({ page }) => {
    for (const slug of ['hidden-story', 'no-such-story']) {
      const res = await page.goto(`/article/${slug}`);
      expect(res?.status()).toBe(404);
      await expect(page.getByRole('heading', { name: /gone off the wire/ })).toBeVisible();
    }
  });
});

test.describe('category pagination', () => {
  test('page 1 has 12 cards and links to a canonical page 2', async ({ page }) => {
    await page.goto('/category/robotics');
    await expect(page).toHaveTitle('Robotics | Synthwire');
    await expect(page.locator('main article')).toHaveCount(12);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      'http://localhost:3110/category/robotics',
    );
    await page.getByRole('link', { name: /Older/ }).click();
    await expect(page).toHaveURL(/\/category\/robotics\/page\/2$/);
    await expect(page.locator('main article')).toHaveCount(2);
    await expect(page).toHaveTitle(/page 2/);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      'http://localhost:3110/category/robotics/page/2',
    );
  });

  test('page 1 redirects to the clean URL; out-of-range and junk pages 404', async ({
    page,
    request,
  }) => {
    await page.goto('/category/robotics/page/1');
    await expect(page).toHaveURL(/\/category\/robotics$/);
    expect((await request.get('/category/robotics/page/9')).status()).toBe(404);
    expect((await request.get('/category/robotics/page/abc')).status()).toBe(404);
    expect((await request.get('/category/unknown')).status()).toBe(404);
  });
});

test.describe('search', () => {
  test('finds stories, is noindex, and ignores too-short queries', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('search').first().getByRole('searchbox').fill('sovereign');
    await page.getByRole('search').first().getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/search\?q=sovereign/);
    await expect(
      page.getByRole('link', { name: 'Sovereign AI strategy for nations' }).first(),
    ).toBeVisible();
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);

    await page.goto('/search?q=a');
    await expect(page.getByText(/results? for/)).toHaveCount(0);
  });
});

test.describe('author page', () => {
  test('lists the author’s stories', async ({ page }) => {
    await page.goto('/author/ada-example');
    await expect(page.locator('h1')).toHaveText('Ada Example');
    await expect(page.locator('main article').first()).toBeVisible();
    await expect(page.getByText('This story was taken down')).toHaveCount(0);
  });
});

test.describe('SEO endpoints', () => {
  test('robots.txt blocks private areas and points to the sitemap', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    expect(body).toMatch(/Disallow: \/admin/);
    expect(body).toMatch(/Disallow: \/search/);
    expect(body).toMatch(/Sitemap: http:\/\/localhost:3110\/sitemap\.xml/);
  });

  test('sitemap index -> article sitemap lists live stories and omits hidden ones', async ({
    request,
  }) => {
    const index = await (await request.get('/sitemap.xml')).text();
    expect(index).toContain('<sitemapindex');
    expect(index).toContain('/sitemaps/articles/1.xml');
    expect(index).toContain('/news-sitemap.xml');
    const res = await request.get('/sitemaps/articles/1.xml');
    expect(res.headers()['content-type']).toContain('application/xml');
    const urls = await res.text();
    expect(urls).toContain('/article/strategy-sovereign-ai');
    expect(urls).not.toContain('hidden-story');
    expect(urls).toMatch(/<lastmod>\d{4}-/);
    expect((await request.get('/sitemaps/articles/zz.xml')).status()).toBe(404);
    const pages = await (await request.get('/sitemaps/pages.xml')).text();
    expect(pages).toContain('/category/robotics');
    expect(pages).toContain('/author/ada-example');
  });

  test('news sitemap carries Google News tags for recent stories', async ({ request }) => {
    const xml = await (await request.get('/news-sitemap.xml')).text();
    expect(xml).toContain('<news:news>');
    expect(xml).toContain('<news:name>Synthwire</news:name>');
    expect(xml).toContain('Sovereign AI strategy for nations');
  });

  test('RSS feed links to our own pages, with summaries only', async ({ request }) => {
    const xml = await (await request.get('/feed.xml')).text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<link>http://localhost:3110/article/');
    expect(xml).not.toContain('hidden-story');
    expect(xml).not.toContain('<content:encoded>');
  });
});

test.describe('newsletter and revalidation', () => {
  test('subscribes from the footer (browser -> API over CORS)', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/about');
    await page.getByLabel('Email address').fill('reader@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByRole('status')).toContainText('on the list');
    expect(errors).toEqual([]);
  });

  test('revalidate endpoint requires the secret', async ({ request }) => {
    expect((await request.post('/api/revalidate', { data: { tags: ['home'] } })).status()).toBe(
      401,
    );
    const bad = await request.post('/api/revalidate', {
      data: { tags: ['home'] },
      headers: { 'x-revalidate-secret': 'nope' },
    });
    expect(bad.status()).toBe(401);
    const ok = await request.post('/api/revalidate', {
      data: { tags: ['home', 'bad tag!'] },
      headers: { 'x-revalidate-secret': 'e2e-revalidate-secret-e2e-1234567' },
    });
    expect(ok.status()).toBe(200);
  });
});

test.describe('security headers', () => {
  test('production responses carry CSP and hardening headers', async ({ request }) => {
    const h = (await request.get('/')).headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-powered-by']).toBeUndefined();
  });
});
