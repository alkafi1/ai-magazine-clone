import { getBranding } from '@/lib/api';
import { ogCard } from '@/lib/og';

export const alt = 'Site card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const b = await getBranding();
  return ogCard(b.tagline || b.name, 'Latest headlines', b);
}
