import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { describeItem, siteDiff } from "../scripts/site-diff.mjs"

const ids = (items: { id: string }[]) => items.map((e) => e.id)

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, stdio: "ignore" })
const writeSite = (dir: string, manifest: object[]) =>
  writeFileSync(path.join(dir, "site.json"), JSON.stringify({ manifest }))

// a site folder that pushed `pushed` to its origin, then rebuilt as `now`
function site(pushed: object[] | null, now: object[]) {
  const dir = mkdtempSync(path.join(tmpdir(), "site-"))
  git(dir, "init", "-q", "-b", "main")
  if (pushed) {
    const origin = mkdtempSync(path.join(tmpdir(), "origin-"))
    git(origin, "init", "-q", "--bare", "-b", "main")
    writeSite(dir, pushed)
    git(dir, "add", ".")
    git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "x")
    git(dir, "remote", "add", "origin", origin)
    git(dir, "push", "-q", "origin", "main")
  }
  writeSite(dir, now)
  return dir
}

const a = { id: "a", hash: "1", kind: "entry", title: "A", date: "2026-10-02" }
const b = { id: "b", hash: "1", kind: "entry", title: "B", date: "2026-10-03" }
const c = { id: "c", hash: "1", kind: "entry", title: "C", date: "2026-10-04" }

describe("siteDiff", () => {
  it("lists what's added, changed and removed since the last push", () => {
    const d = siteDiff(site([a, b], [{ ...a, hash: "2" }, c]))
    expect(d.pushedBefore).toBe(true)
    expect(ids(d.added)).toEqual(["c"])
    expect(ids(d.changed)).toEqual(["a"])
    expect(ids(d.removed)).toEqual(["b"])
  })

  it("counts everything as new when never pushed", () => {
    const d = siteDiff(site(null, [a, b]))
    expect(d.pushedBefore).toBe(false)
    expect(d.added).toHaveLength(2)
    expect(d.changed).toEqual([])
    expect(d.removed).toEqual([])
  })
})

describe("describeItem", () => {
  it("names an entry by title and day, or counts passages", () => {
    expect(describeItem({ ...a, date: "2026-10-02T12:00:00" })).toBe(
      "“A” (Oct 2, 2026)",
    )
    expect(
      describeItem({ kind: "entry", title: "", date: "2026-10-02T12:00:00" }),
    ).toBe("“Untitled thought” (Oct 2, 2026)")
    expect(
      describeItem({
        kind: "passages",
        passages: 1,
        date: "2026-10-02T12:00:00",
      }),
    ).toBe("1 passage from Oct 2, 2026")
  })
})
