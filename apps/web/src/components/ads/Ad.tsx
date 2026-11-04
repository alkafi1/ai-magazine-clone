import type { PlacementKey } from '@aimag/shared';
import { getSiteConfig } from '@/lib/api';
import { AdSlot } from './AdSlot';

/** Server wrapper: looks up the placement in the admin settings and renders nothing if it is off. */
export async function Ad({ slot, className }: { slot: PlacementKey; className?: string }) {
  const { ads } = await getSiteConfig();
  const p = ads.placements[slot];
  if (!ads.enabled || !p) return null;
  return (
    <AdSlot
      provider={ads.provider}
      clientId={ads.clientId}
      slotId={p.slotId}
      html={p.html}
      consentRequired={ads.consentRequired}
      label={slot}
      className={className}
    />
  );
}

/** How many stories between in-feed ads (0 when in-feed ads are off). */
export async function inFeedEvery(): Promise<number> {
  const { ads } = await getSiteConfig();
  return ads.enabled && ads.placements.inFeed ? ads.inFeedEvery : 0;
}
