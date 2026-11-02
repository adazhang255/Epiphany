import { existsSync } from "node:fs"
import path from "node:path"
import type { NextConfig } from "next"
import { siteBasePath } from "./scripts/site-base-path.mjs"

// The public site is this same app, exported as static files (see
// scripts/build-public-site.mjs, which sets STATIC_EXPORT).
const exporting = Boolean(process.env.STATIC_EXPORT)
const publishDir = path.resolve(process.env.PUBLISH_DIR ?? "public-site")
const basePath: string = siteBasePath(publishDir)

// This project's own folder: the nearest one with a package-lock.json (the
// public site's working copy in .public-build has none, so it's the project
// around it, whose node_modules it shares). Set so that a stray lockfile in a
// folder above never gets taken for the project's root.
function projectRoot(dir = process.cwd()): string {
  if (existsSync(path.join(dir, "package-lock.json"))) return dir
  const up = path.dirname(dir)
  return up === dir ? process.cwd() : projectRoot(up)
}
const root = projectRoot()

const nextConfig: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
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
