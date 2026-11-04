import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// One shared .env at the repo root (ignored if missing, e.g. in Docker where env vars are injected).
try {
  process.loadEnvFile(resolve(process.cwd(), '../../.env'));
} catch {
  // no root .env file: rely on the real environment
}

const isProd = process.env.NODE_ENV === 'production';
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').origin;

// Next injects inline bootstrap scripts, so script-src needs 'unsafe-inline' without a nonce setup.
// Everything else is locked to our own origin plus the source's image CDN and our API.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://assets.bizclikmedia.net",
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const config: NextConfig = {
  // Only used when IMAGE_OPTIMIZE=true (see components/Cover.tsx).
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'assets.bizclikmedia.net' }],
    formats: ['image/webp'],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...(isProd ? [{ key: 'Content-Security-Policy', value: csp }] : []),
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
