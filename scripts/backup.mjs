// Back up the journal: a consistent copy of the database (safe while the app
// is running), named by date, keeping the most recent ones.
//   npm run backup                 back up now
//   node scripts/backup.mjs --if-due   only if the newest copy is a day old
//                                  (the app runs this hourly while it's open)
//   npm run backup:schedule        also nightly via macOS launchd (needs Full
//                                  Disk Access for node; see the README)
//   npm run backup:unschedule      stop that
// Settings (.env.local): BACKUP_DIR (default backups/journal, git-ignored;
// e.g. a folder in iCloud Drive or on an external disk), BACKUP_KEEP
// (default 30 copies).
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"

// a setting from the environment or .env.local
function setting(name) {
  if (process.env[name]) return process.env[name]
  if (!existsSync(".env.local")) return undefined
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith(`${name}=`))
  return line
    ?.split("=")
    .slice(1)
    .join("=")
    .replace(/#.*$/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
}

const home = process.env.HOME ?? ""
const journal = path.resolve(
  (setting("DATABASE_URL") ?? "file:./dev.db").replace(/^file:/, ""),
)
const dir = path.resolve(
  (setting("BACKUP_DIR") ?? "backups/journal").replace(/^~(?=\/)/, home),
)
const keep = Math.max(1, Number(setting("BACKUP_KEEP")) || 30)
const log = (line) => {
  const text = `${new Date().toISOString()} ${line}`
  console.log(text)
  try {
    appendFileSync(path.join(dir, "backup.log"), text + "\n")
  } catch {}
}

// the demo database (npm run dev:demo, demo:seed) isn't your journal: a copy
// of it would count as today's backup and push real ones out
if (path.basename(journal) === "demo.db") {
  if (!process.argv.includes("--if-due"))
    console.log("demo.db is made-up entries; not backed up.")
  process.exit(0)
}
if (!existsSync(journal)) {
  console.error(`No journal at ${journal}; nothing to back up.`)
  process.exit(1)
}
mkdirSync(dir, { recursive: true })

const ownCopy = (f) => /^journal-\d{4}-\d{2}-\d{2}-\d{4}\.db$/.test(f)
if (process.argv.includes("--if-due")) {
  const newest = Math.max(
    0,
    ...readdirSync(dir)
      .filter(ownCopy)
      .map((f) => statSync(path.join(dir, f)).mtimeMs),
  )
  if (Date.now() - newest < 23 * 60 * 60 * 1000) process.exit(0)
}

const d = new Date()
const pad = (n) => String(n).padStart(2, "0")
const name = `journal-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.db`
const target = path.join(dir, name)

const db = new Database(journal, { readonly: true, fileMustExist: true })
try {
  await db.backup(target)
} finally {
  db.close()
}
const size = (statSync(target).size / 1024 / 1024).toFixed(1)

// only this script's own copies are ever removed, oldest first
const copies = readdirSync(dir).filter(ownCopy).sort()
const old = copies.slice(0, Math.max(0, copies.length - keep))
for (const f of old) rmSync(path.join(dir, f))
log(
  `Backed up ${path.basename(journal)} → ${target} (${size} MB). ${Math.min(copies.length, keep)} kept${old.length ? `, ${old.length} older removed` : ""}.`,
)
