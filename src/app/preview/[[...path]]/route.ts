import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { PUBLISH_DIR } from "@/features/publish/buildSite"

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
}

// Serves the built public site locally so you can check it before pushing.
// (It's also reachable at its GitHub Pages path, e.g. /thedetective/, through
// a rewrite in next.config.ts, so its own links work here too.)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path: parts = [] } = await params
  let file = path.resolve(/*turbopackIgnore: true*/ PUBLISH_DIR, ...parts)
  if (file !== PUBLISH_DIR && !file.startsWith(PUBLISH_DIR + path.sep)) {
    return new Response("Not found", { status: 404 })
  }
  // a folder (the site's pages are folder/index.html)
  if (
    await stat(/*turbopackIgnore: true*/ file)
      .then((s) => s.isDirectory())
      .catch(() => false)
  )
    file = path.join(/*turbopackIgnore: true*/ file, "index.html")
  try {
    const body = await readFile(/*turbopackIgnore: true*/ file)
    return new Response(body, {
      headers: {
        "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return new Response("Not built yet. Use Build site on the Publish page.", {
      status: 404,
    })
  }
}
