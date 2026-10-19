import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import Database from "better-sqlite3"
import { describe, expect, it } from "vitest"

const script = path.resolve("scripts/backup.mjs")

// run the backup in a throwaway folder (so it never sees .env.local or your
// journal) on a database named `name`
function backup(name: string, args: string[] = [], keep = "30") {
  const dir = mkdtempSync(path.join(tmpdir(), "backup-"))
  const db = new Database(path.join(dir, name))
  db.exec("create table t (x)")
  db.close()
  const out = path.join(dir, "out")
  const run = () =>
    execFileSync(process.execPath, [script, ...args], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: `file:./${name}`,
        BACKUP_DIR: out,
        BACKUP_KEEP: keep,
      },
    })
  return { dir, out, run }
}

const copies = (out: string) => {
  try {
    return readdirSync(out).filter((f) => f.endsWith(".db"))
  } catch {
    return []
  }
}

describe("backup", () => {
  it("copies the journal into the backup folder", () => {
    const { out, run } = backup("journal.db")
    run()
    expect(copies(out)).toHaveLength(1)
  })

  it("never backs up demo.db, so it can't stand in for a real backup", () => {
    const { out, run } = backup("demo.db")
    expect(run()).toMatch(/not backed up/)
    expect(copies(out)).toEqual([])
    const due = backup("demo.db", ["--if-due"])
    expect(due.run()).toBe("")
    expect(copies(due.out)).toEqual([])
  })

  it("keeps only BACKUP_KEEP of its own copies, oldest removed first", () => {
    const { out, run } = backup("journal.db", [], "2")
    run()
    const [first] = copies(out)
    // two older copies of its own, and a file it didn't make
    const old = (d: string) => path.join(out, `journal-2020-01-0${d}-0000.db`)
    writeFileSync(old("1"), "")
    writeFileSync(old("2"), "")
    writeFileSync(path.join(out, "mine.db"), "")
    run() // replaces today's copy (same minute), then trims to 2
    expect(first).toMatch(/^journal-\d{4}-\d{2}-\d{2}-\d{4}\.db$/)
    expect(copies(out).sort()).toEqual([
      path.basename(old("2")),
      first,
      "mine.db",
    ])
  })
})
