import { getArticles, getBranding, getCategories } from '@/lib/api';
import { rssResponse } from '@/lib/rss';

export const revalidate = 300;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response('Not found', { status: 404 });
  const [b, cat, list] = await Promise.all([
    getBranding(),
    getCategories()
      .then((c) => c.find((x) => x.slug === slug))
      .catch(() => undefined),
    getArticles({ category: slug }, 1).catch(() => null),
  ]);
  if (!cat || !list) return new Response('Not found', { status: 404 });
  return rssResponse({
    title: `${cat.name} | ${b.name}`,
    description: cat.description ?? `The latest ${cat.name} stories on ${b.name}.`,
    selfPath: `/category/${slug}/feed.xml`,
    linkPath: `/category/${slug}`,
    items: list.items,
  });
}
