import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep HMR artifacts isolated so `next build` cannot invalidate a running
    // development server and briefly turn valid routes into 500 responses.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',

    // Native binary packages — must not be bundled by webpack
    serverExternalPackages: ['@resvg/resvg-js'],

    // Social-card routes read the Kanit TTFs at request time; make sure the
    // serverless bundle on Vercel carries them (they are not imported, so file
    // tracing would otherwise leave them out).
    outputFileTracingIncludes: {
      '/opengraph-image': ['./public/fonts/*.ttf'],
      '/twitter-image': ['./public/fonts/*.ttf'],
    },

    poweredByHeader: false,

    async headers() {
      const common = [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
        // SAMEORIGIN, not DENY: the portal previews /display pages in an iframe.
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        // Report-only first so a missed third-party origin cannot break LIFF or
        // payments; switch to enforcing once reports are clean.
        { key: 'Content-Security-Policy-Report-Only', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" },
      ];
      const hsts = { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' };
      return [
        { source: '/:path*', headers: phase === PHASE_DEVELOPMENT_SERVER ? common : [...common, hsts] },
        // Portal pages carry tenant data: never cache them in shared caches.
        { source: '/portal/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      ];
    },
  };
}
