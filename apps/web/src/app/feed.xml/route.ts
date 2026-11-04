import { getBranding, getFeed } from '@/lib/api';
import { rssResponse } from '@/lib/rss';

export const revalidate = 300;

/** Our own RSS feed: headline + summary + link to our page. */
export async function GET() {
  const [items, b] = await Promise.all([getFeed().catch(() => []), getBranding()]);
  return rssResponse({
    title: b.name,
    description: b.description,
    selfPath: '/feed.xml',
    linkPath: '/',
    items,
  });
}
