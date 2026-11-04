import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// One shared .env at the repo root (ignored if missing, e.g. in Docker where env vars are injected).
try {
  process.loadEnvFile(resolve(process.cwd(), '../../.env'));
} catch {
  // no root .env file: rely on the real environment
}

const config: NextConfig = {
  // Self-contained server bundle for the Docker image (traced from the monorepo root).
  output: 'standalone',
  // Docker's legacy builder forbids signalling child processes (kill EACCES at the end of the build),
  // so the Dockerfile sets NEXT_BUILD_THREADS=1 to use worker threads instead.
  experimental: { workerThreads: process.env.NEXT_BUILD_THREADS === '1' },
  outputFileTracingRoot: resolve(process.cwd(), '../../'),
  // The Content-Security-Policy is set per request in src/proxy.ts (it depends on the admin ad settings).
  // The e2e suite builds into its own dir so it never clobbers a running dev/prod build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
