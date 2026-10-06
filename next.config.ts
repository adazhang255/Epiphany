import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Normally .next. Set NEXT_DIST_DIR (e.g. ".next-test") to build and serve a
  // separate copy, so a test build never replaces the one a running server uses.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
