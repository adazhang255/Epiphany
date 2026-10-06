import { readFile } from "node:fs/promises"
import path from "node:path"
import { PUBLISH_DIR } from "@/features/publish/buildSite"

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
}

// Serves the built public site locally so you can check it before pushing.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path: parts = [] } = await params
  if (parts.length === 0) {
    // relative links in the site need the trailing file name
    return Response.redirect(new URL("/preview/index.html", _req.url), 307)
  }

  const file = path.resolve(/*turbopackIgnore: true*/ PUBLISH_DIR, ...parts)
  if (!file.startsWith(PUBLISH_DIR + path.sep)) {
    return new Response("Not found", { status: 404 })
  }
  try {
    const body = await readFile(file)
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
