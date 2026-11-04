import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { SITE } from '@/lib/site';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { types: { 'application/rss+xml': `${SITE.url}/feed.xml` } },
  openGraph: { siteName: SITE.name, type: 'website', locale: 'en_GB' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#0c1222', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
