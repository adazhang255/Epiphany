import path from "node:path"
import type { NextConfig } from "next"
import { siteBasePath } from "./scripts/site-base-path.mjs"

// The public site is this same app, exported as static files (see
// scripts/build-public-site.mjs, which sets STATIC_EXPORT).
const exporting = Boolean(process.env.STATIC_EXPORT)
const publishDir = path.resolve(process.env.PUBLISH_DIR ?? "public-site")
const basePath: string = siteBasePath(publishDir)

const nextConfig: NextConfig = {
  // Normally .next. Set NEXT_DIST_DIR (e.g. ".next-test") to build and serve a
  // separate copy, so a test build never replaces the one a running server uses.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  ...(exporting
    ? {
        output: "export",
        trailingSlash: true, // /notebook/ → notebook/index.html on GitHub Pages
        ...(basePath ? { basePath } : {}),
        images: { unoptimized: true },
      }
    : basePath
      ? {
          // locally, the built site is previewed at its own path, as on GitHub
          async rewrites() {
            return [
              { source: basePath, destination: "/preview/index.html" },
              { source: `${basePath}/:path*`, destination: "/preview/:path*" },
            ]
          },
        }
      : {}),
}

export default nextConfig
