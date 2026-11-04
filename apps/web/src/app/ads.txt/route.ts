import { getSiteConfig } from '@/lib/api';

export const revalidate = 300;

/** ads.txt: authorises your ad network(s) to sell your inventory. Built from the admin Ads settings. */
export async function GET() {
  const { ads } = await getSiteConfig();
  const lines: string[] = [];
  if (ads.clientId)
    lines.push(`google.com, ${ads.clientId.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0`);
  lines.push(
    ...ads.adsTxt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  );
  if (!ads.enabled || lines.length === 0) return new Response('Not found', { status: 404 });
  return new Response(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
