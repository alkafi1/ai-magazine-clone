import { ogCard } from '@/lib/og';
import { SITE } from '@/lib/site';

export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('The wire for artificial intelligence news', 'Curated AI headlines');
}
