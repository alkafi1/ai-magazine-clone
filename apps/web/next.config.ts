import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// One shared .env at the repo root (ignored if missing, e.g. in Docker where env vars are injected).
try {
  process.loadEnvFile(resolve(process.cwd(), '../../.env'));
} catch {
  // no root .env file: rely on the real environment
}

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
