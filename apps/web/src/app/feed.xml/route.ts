import { getFeed } from '@/lib/api';
import { rssResponse } from '@/lib/rss';
import { SITE } from '@/lib/site';

export const revalidate = 300;

/** Our own RSS feed: headline + summary + link to our page. */
export async function GET() {
  const items = await getFeed().catch(() => []);
  return rssResponse({
    title: SITE.name,
    description: SITE.description,
    selfPath: '/feed.xml',
    linkPath: '/',
    items,
  });
}
