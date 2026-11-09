// Before `npm run dev` / `npm start`: make sure the database driver works
// with this Node.js, and that the journal database has its tables. A new
// copy (no database yet, or an empty one: started without `npm run setup`)
// gets them made, empty. A journal that already has entries is never
// changed here: if it's missing newer tables, this says how to add them.
// Only the list of tables is read, never what's in them.
import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

// The database driver is compiled for one Node.js version: after switching
// Node (a Codespace, nvm, an upgrade) it won't load until it's rebuilt for
// this one. Tried in a separate process, so a failed load doesn't stick.
const driverWorks = () => {
  try {
    execSync(
      `"${process.execPath}" -e "new (require('better-sqlite3'))(':memory:').close()"`,
      { stdio: "pipe" },
    )
    return ""
  } catch (error) {
    return String(error.stderr ?? error.message)
  }
}
const problem = driverWorks()
if (problem) {
  if (!/NODE_MODULE_VERSION|ERR_DLOPEN_FAILED|self-register/.test(problem)) {
    console.error(problem)
    process.exit(1)
  }
  console.log(
    `• The database driver was built for another Node.js version; rebuilding it for this one (${process.version})…`,
  )
  // with this same Node first on the PATH (the build uses whichever is)
  const npm = process.env.npm_execpath
  execSync(
    npm
      ? `"${process.execPath}" "${npm}" rebuild better-sqlite3`
      : "npm rebuild better-sqlite3",
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`,
      },
    },
  )
  const still = driverWorks()
  if (still) {
    console.error(
      `${still}\nCouldn't rebuild it. Try: rm -rf node_modules && npm install`,
    )
    process.exit(1)
  }
  console.log("✓ Rebuilt the database driver")
}
const { default: Database } = await import("better-sqlite3")

// the database the app will use: DATABASE_URL, as set here or in .env.local
// or .env (as Next reads them), else dev.db
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue
    const line = readFileSync(file, "utf8")
      .split("\n")
      .find((l) => /^\s*DATABASE_URL\s*=/.test(l))
    if (line)
      return line
        .replace(/^\s*DATABASE_URL\s*=\s*/, "")
        .replace(/\s+#.*$/, "")
        .trim()
        .replace(/^(["'])(.*)\1$/, "$2")
  }
  return "file:./dev.db"
}

const url = databaseUrl()
if (!url.startsWith("file:")) process.exit(0) // not a local SQLite file
const file = path.resolve(url.slice("file:".length))

// the tables the app expects (one per model in the schema)
const models = [
  ...readFileSync("prisma/schema.prisma", "utf8").matchAll(
    /^model\s+(\w+)\s*\{/gm,
  ),
].map((m) => m[1])

let tables = []
if (existsSync(file)) {
  const db = new Database(file, { readonly: true, fileMustExist: true })
  tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((t) => t.name)
  db.close()
}
const missing = models.filter((m) => !tables.includes(m))
if (missing.length === 0) process.exit(0)

const relative = path.relative(process.cwd(), file)
if (!tables.includes("Note")) {
  // new: an empty journal, made the way `npm run setup` makes it
  execSync("npx prisma db push", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: url },
  })
  console.log(
    `✓ Created your journal (${relative}), empty. Run \`npm run setup\` once for settings and an AI model check.`,
  )
} else {
  console.log(
    `• Your journal (${relative}) is missing newer tables (${missing.join(", ")}). Add them with:\n    npm run db:push\n  (your entries are kept)`,
  )
}
