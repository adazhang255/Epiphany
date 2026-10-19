// Build the public site: this same app, read-only, with only the entries you
// marked public, exported as static files into public-site/ (or PUBLISH_DIR)
// for GitHub Pages.
//   npm run publish:build        (the Publish page's Build site runs this)
// How: copy the journal to a temporary database and delete every entry that
// isn't public from the copy (your journal is only read, never changed);
// build the app from that copy in .public-build/ with the public settings
// (no editing, no AI, no server); then copy the result into the site folder,
// keeping its .git, CNAME and README. Optional settings (JSON) on stdin or
// as the first argument: { "title": "...", "description": "...", "author": "..." }
import { execSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import Database from "better-sqlite3"
import { siteBasePath } from "./site-base-path.mjs"

const root = process.cwd()
const work = path.join(root, ".public-build")

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

const settings = (() => {
  try {
    return JSON.parse(process.argv[2] ?? "{}")
  } catch {
    return {}
  }
})()
const journal = path.resolve(
  (setting("DATABASE_URL") ?? "file:./dev.db").replace(/^file:/, ""),
)
const site = path.resolve(setting("PUBLISH_DIR") ?? "public-site")
const basePath = siteBasePath(site)
const step = (text) => console.log(`• ${text}`)

if (!existsSync(journal)) {
  console.error(`No journal at ${journal}.`)
  process.exit(1)
}

// 1. a working copy of the app, without the parts that edit or need a server
step("Preparing a copy of the app")
rmSync(work, { recursive: true, force: true })
mkdirSync(work)
for (const item of [
  "src",
  "public",
  "prisma",
  "scripts",
  "package.json",
  "next.config.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "prisma.config.ts",
]) {
  if (existsSync(item)) cpSync(item, path.join(work, item), { recursive: true })
}
symlinkSync(path.join(root, "node_modules"), path.join(work, "node_modules"))
for (const route of [
  "api",
  "write",
  "import",
  "ask",
  "publish",
  "preview",
  "questions", // only a redirect to the timeline's Question filter
]) {
  rmSync(path.join(work, "src/app", route), { recursive: true, force: true })
}
// pages are built once, not per visit
function eachPage(dir, fn) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) eachPage(p, fn)
    else if (entry.name === "page.tsx") fn(p)
  }
}
eachPage(path.join(work, "src/app"), (p) => {
  const s = readFileSync(p, "utf8")
  writeFileSync(p, s.replace(/^export const dynamic = "force-dynamic"\n/m, ""))
})
// one page per public entry
const entryPage = path.join(work, "src/app/notes/[id]/page.tsx")
writeFileSync(
  entryPage,
  readFileSync(entryPage, "utf8") +
    `
// (public site only) build a page for every entry in the public copy
export async function generateStaticParams() {
  const { prisma } = await import("@/lib/prisma")
  const notes = await prisma.note.findMany({ select: { id: true } })
  return notes.map((n) => ({ id: n.id }))
}
export const dynamicParams = false
`,
)

// 2. the journal, with only the public entries
step("Copying only your public entries")
const copy = path.join(work, "public.db")
{
  const source = new Database(journal, { readonly: true, fileMustExist: true })
  await source.backup(copy)
  source.close()
}
const db = new Database(copy)
db.exec("PRAGMA foreign_keys = OFF")
// Entries that stay private but have passages shared on their own: in the
// copy they become just those passages (no title, none of the rest of the
// text, no other highlights or questions), then count as public.
const partial = db
  .prepare(
    `SELECT DISTINCT noteId AS id FROM Quote WHERE published = 1
     AND noteId IN (SELECT id FROM Note WHERE published = 0)`,
  )
  .all()
  .map((r) => r.id)
const passagesOf = db.prepare(
  "SELECT quote FROM Quote WHERE noteId = ? AND published = 1 ORDER BY createdAt",
)
const toPassages = db.prepare(
  `UPDATE Note SET title = '', content = ?, ownCategory = '', sentiment = NULL,
   embedding = NULL, topics = '', tags = '', autoTags = '', published = 1
   WHERE id = ?`,
)
for (const id of partial) {
  const text = passagesOf
    .all(id)
    .map((r) => r.quote)
    .join("\n\n…\n\n")
  db.prepare("DELETE FROM Quote WHERE noteId = ? AND published = 0").run(id)
  db.prepare("DELETE FROM Question WHERE noteId = ?").run(id)
  toPassages.run(text, id)
}
const priv = "SELECT id FROM Note WHERE published = 0"
db.exec(`
  DELETE FROM Quote WHERE noteId IN (${priv});
  UPDATE Quote SET answerNoteId = NULL WHERE answerNoteId IN (${priv});
  DELETE FROM Question WHERE noteId IN (${priv});
  UPDATE Question SET answerNoteId = NULL WHERE answerNoteId IN (${priv});
  UPDATE Quote SET replyToId = NULL WHERE replyToId IS NOT NULL AND replyToId NOT IN (SELECT id FROM Question);
  DELETE FROM Note WHERE published = 0;
  UPDATE Note SET source = '';
`)
// what's on the site, for the "what will change" check before pushing
const manifest = db
  .prepare("SELECT id, title, date, content FROM Note ORDER BY date")
  .all()
  .map((n) => {
    const quotes = db
      .prepare(
        "SELECT quote, category FROM Quote WHERE noteId = ? ORDER BY createdAt",
      )
      .all(n.id)
    const kind = partial.includes(n.id) ? "passages" : "entry"
    return {
      id: n.id,
      kind,
      title: kind === "entry" ? n.title : "",
      date: new Date(n.date).toISOString(),
      ...(kind === "passages" ? { passages: quotes.length } : {}),
      hash: createHash("sha1")
        .update(JSON.stringify([n.title, n.content, quotes]))
        .digest("hex")
        .slice(0, 12),
    }
  })
const entries = db.prepare("SELECT COUNT(*) AS n FROM Note").get().n
db.exec("VACUUM") // nothing deleted lingers in the file
db.close()
console.log(
  `  ${entries - partial.length} public ${entries - partial.length === 1 ? "entry" : "entries"}` +
    (partial.length ? `, and passages from ${partial.length} more` : ""),
)

// 3. build it
step(`Building the site${basePath ? ` (served at ${basePath}/)` : ""}`)
// a clean environment: nothing from a server that started this (its build
// folder, its mode) may leak into the site's build
const inherited = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k]) =>
      !k.startsWith("__NEXT") &&
      !k.startsWith("NEXT_") &&
      !["NODE_ENV", "TURBOPACK", "PORT"].includes(k),
  ),
)
const env = {
  ...inherited,
  DATABASE_URL: `file:${copy}`,
  NEXT_PUBLIC_SITE_MODE: "public",
  NEXT_PUBLIC_BASE_PATH: basePath,
  NEXT_PUBLIC_SITE_TITLE: settings.title?.trim() || "",
  NEXT_PUBLIC_SITE_AUTHOR: settings.author?.trim() || "",
  NEXT_PUBLIC_SITE_DESCRIPTION: settings.description?.trim() || "",
  PUBLISH_DIR: site,
  STATIC_EXPORT: "1",
  NEXT_TELEMETRY_DISABLED: "1",
}
try {
  execSync("npx next build", {
    cwd: work,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
} catch (error) {
  const out = `${error.stdout ?? ""}${error.stderr ?? ""}`
  console.error(`The build failed:\n${out.split("\n").slice(-40).join("\n")}`)
  process.exit(1)
}

// 4. into the site folder (its .git, CNAME and README stay)
step(`Writing it to ${path.relative(root, site) || site}`)
mkdirSync(site, { recursive: true })
for (const item of readdirSync(site)) {
  if ([".git", "CNAME", "README.md"].includes(item)) continue
  rmSync(path.join(site, item), { recursive: true, force: true })
}
cpSync(path.join(work, "out"), site, { recursive: true })
writeFileSync(path.join(site, ".nojekyll"), "") // serve the _next folder as-is
const builtAt = new Date().toISOString()
writeFileSync(
  path.join(site, "site.json"),
  JSON.stringify(
    {
      title: settings.title ?? "",
      description: settings.description ?? "",
      author: settings.author ?? "",
      basePath,
      builtAt,
      entries,
      manifest,
    },
    null,
    2,
  ),
)
rmSync(work, { recursive: true, force: true })
console.log(JSON.stringify({ dir: site, entries, builtAt, basePath }))
