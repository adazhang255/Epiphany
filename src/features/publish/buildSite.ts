import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"

// The public site: this same app, read-only, built from your public entries
// only (scripts/build-public-site.mjs) into this folder, which becomes its
// own GitHub Pages repository. (Read and written at runtime only, so the
// bundler shouldn't trace it.)
export const PUBLISH_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.PUBLISH_DIR ?? "public-site",
)

export type SiteSettings = {
  title: string
  description: string
  author: string
}

export type SiteInfo = SiteSettings & {
  builtAt: string | null
  entries: number
  basePath: string // the path GitHub Pages serves it under, e.g. "/thedetective"
}

const DEFAULTS: SiteSettings = {
  title: "Reflections",
  description: "Passages worth keeping, laid out across time.",
  author: "",
}

export async function readSiteInfo(): Promise<SiteInfo> {
  const empty = { ...DEFAULTS, builtAt: null, entries: 0, basePath: "" }
  try {
    const raw = JSON.parse(
      await readFile(
        path.join(/*turbopackIgnore: true*/ PUBLISH_DIR, "site.json"),
        "utf8",
      ),
    )
    return { ...empty, ...raw, title: raw.title || DEFAULTS.title }
  } catch {
    return empty
  }
}

// Build it (about a minute). Resolves with the build script's summary.
export function buildSite(settings: Partial<SiteSettings>) {
  return new Promise<{ entries: number; dir: string; builtAt: string }>(
    (resolve, reject) => {
      execFile(
        /*turbopackIgnore: true*/ process.execPath,
        [
          path.join(
            /*turbopackIgnore: true*/ process.cwd(),
            "scripts/build-public-site.mjs",
          ),
          JSON.stringify(settings),
        ],
        { cwd: /*turbopackIgnore: true*/ process.cwd(), maxBuffer: 20 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            const why = `${stderr}\n${stdout}`.trim().split("\n").slice(-12)
            return reject(new Error(why.join("\n") || error.message))
          }
          const last = stdout.trim().split("\n").at(-1) ?? "{}"
          resolve(JSON.parse(last))
        },
      )
    },
  )
}
