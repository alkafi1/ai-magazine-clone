import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

/** Branded 1200x630 card. We generate our own image and never re-share the source's picture. */
export function ogCard(title: string, kicker: string, brand: { name: string; tagline: string }) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#0c1222',
        color: '#faf8f3',
        padding: 72,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        <div
          style={{ width: 18, height: 18, borderRadius: 9, background: '#ffb703', marginRight: 16 }}
        />
        {brand.name.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontSize: 28,
            color: '#a99bff',
            marginBottom: 20,
            textTransform: 'uppercase',
            letterSpacing: 3,
          }}
        >
          {kicker}
        </div>
        <div style={{ fontSize: title.length > 80 ? 56 : 70, fontWeight: 800, lineHeight: 1.1 }}>
          {title}
        </div>
      </div>
      <div style={{ fontSize: 26, color: '#9aa3b8' }}>{brand.tagline}</div>
    </div>,
    OG_SIZE,
  );
}
