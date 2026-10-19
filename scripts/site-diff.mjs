// What a push would change on the public site: the built site's contents
// (site.json → manifest) against the version last pushed to GitHub
// (origin/main:site.json in the site folder). Used by `npm run publish:push`
// and the Publish page.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

function manifestOf(json) {
  try {
    return JSON.parse(json).manifest ?? []
  } catch {
    return []
  }
}

// { added, changed, removed, pushedBefore } — each a list of manifest items
export function siteDiff(dir) {
  const file = path.join(/*turbopackIgnore: true*/ dir, "site.json")
  const now = existsSync(file) ? manifestOf(readFileSync(file, "utf8")) : []
  let before = []
  let pushedBefore = false
  try {
    before = manifestOf(
      execFileSync("git", ["show", "origin/main:site.json"], {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    )
    pushedBefore = true
  } catch {
    // never pushed (or pushed before the site listed its contents)
  }
  const old = new Map(before.map((e) => [e.id, e]))
  const cur = new Map(now.map((e) => [e.id, e]))
  return {
    added: now.filter((e) => !old.has(e.id)),
    changed: now.filter((e) => old.has(e.id) && old.get(e.id).hash !== e.hash),
    removed: before.filter((e) => !cur.has(e.id)),
    pushedBefore,
  }
}

// "“Title” (Oct 2, 2026)" or "passages from Oct 2, 2026"
export function describeItem(e) {
  const day = new Date(e.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return e.kind === "passages"
    ? `${e.passages} ${e.passages === 1 ? "passage" : "passages"} from ${day}`
    : // (without the mark on titles the local AI wrote)
      `“${(e.title ?? "").replaceAll("\u2063", "") || "Untitled thought"}” (${day})`
}
