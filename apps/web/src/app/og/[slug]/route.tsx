import { getArticle, getBranding } from '@/lib/api';
import { ogCard } from '@/lib/og';

export const revalidate = 3600;

/** Stable URL for an article's social card: /og/<slug> (slug is looked up, never trusted). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response('Not found', { status: 404 });
  const a = await getArticle(slug).catch(() => null);
  if (!a) return new Response('Not found', { status: 404 });
  return ogCard(a.title, a.category?.name ?? 'News', await getBranding());
}
