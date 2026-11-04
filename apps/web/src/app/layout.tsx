import { THEMES } from '@aimag/shared';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, Playfair_Display, Source_Serif_4, Space_Grotesk } from 'next/font/google';
import { getSiteConfig } from '@/lib/api';
import { SITE, safeImageUrl } from '@/lib/site';
import './globals.css';

// Fonts are declared for every theme but only downloaded when a page actually uses them (preload is off for
// the optional ones), so the active theme's fonts are the only extra bytes.
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  preload: false,
});
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
  preload: false,
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
  preload: false,
});
const fontVars = [fraunces, inter, playfair, sourceSerif, spaceGrotesk]
  .map((f) => f.variable)
  .join(' ');

export async function generateMetadata(): Promise<Metadata> {
  const { branding: b } = await getSiteConfig();
  const icon = safeImageUrl(b.faviconUrl);
  return {
    metadataBase: new URL(SITE.url),
    title: { default: `${b.name} — ${b.tagline}`, template: `%s | ${b.name}` },
    description: b.description,
    applicationName: b.name,
    alternates: { types: { 'application/rss+xml': `${SITE.url}/feed.xml` } },
    openGraph: { siteName: b.name, type: 'website', locale: 'en_GB' },
    twitter: { card: 'summary_large_image' },
    ...(icon ? { icons: { icon } } : {}),
  };
}

export const viewport: Viewport = { themeColor: '#0c1222', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme } = await getSiteConfig();
  const safeTheme = (THEMES as readonly string[]).includes(theme) ? theme : 'synthwire';
  return (
    <html lang="en" suppressHydrationWarning data-theme={safeTheme} className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
