import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native binary packages — must not be bundled by webpack
  serverExternalPackages: ['@resvg/resvg-js'],
};

export default nextConfig;
