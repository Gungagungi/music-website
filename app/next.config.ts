import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The demo store is deliberately dependency-free at runtime: no external image
  // host, no database. Everything is served from the app itself so that the test
  // suite is fully deterministic and can run offline.
  poweredByHeader: false,
};

export default nextConfig;
