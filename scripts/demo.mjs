// Add the made-up demo entries to a journal, or take them out again.
//   npm run demo:add                 add them (to dev.db, or DATABASE_URL)
//   npm run demo:add -- --analyze    …and read them: highlights, categories,
//                                    tone, embeddings (needs `ollama serve`)
//   npm run demo:remove              remove every demo entry, nothing else
// Each demo entry carries the hidden tag "demo"; removing deletes only
// entries with that tag (and their highlights and questions). Your own
// entries are never read or changed.
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { DEMO_ENTRIES } from "./demo-entries.mjs"

const MARK = "demo"
const PORT = 3098
const BASE = `http://127.0.0.1:${PORT}`
const [command] = process.argv.slice(2)
const analyze = process.argv.includes("--analyze")

if (command !== "add" && command !== "remove") {
  console.log("Usage: node scripts/demo.mjs add [--analyze] | remove")
  process.exit(1)
}

// the journal the app uses: DATABASE_URL from the environment or
// .env.local, else dev.db
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  if (existsSync(".env.local")) {
    const line = readFileSync(".env.local", "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith("DATABASE_URL="))
    if (line)
      return line
        .split("=")
        .slice(1)
        .join("=")
        .trim()
        .replace(/^["']|["']$/g, "")
  }
  return "file:./dev.db"
}
const url = databaseUrl()
const file = path.resolve(url.replace(/^file:/, ""))
if (!existsSync(file)) {
  console.log(`No database at ${file} yet. Run \`npm run db:push\` first.`)
  process.exit(1)
}

// only ever ids of entries tagged as demo
function demoIds() {
  const db = new Database(file, { readonly: true })
  try {
    return db
      .prepare("SELECT id FROM Note WHERE tags = ?")
      .all(MARK)
      .map((r) => r.id)
  } finally {
    db.close()
  }
}

const existing = demoIds()
if (command === "add" && existing.length > 0) {
  console.log(
    `${existing.length} demo entries are already there. Run \`npm run demo:remove\` first to start over.`,
  )
  process.exit(0)
}
if (command === "remove" && existing.length === 0) {
  console.log("No demo entries to remove.")
  process.exit(0)
}

// Changes go through the app itself (on a temporary server), so highlights,
// questions and everything else stay consistent.
console.log(`Starting a temporary server on ${path.basename(file)}…`)
const server = spawn(
  "npx",
  ["next", "dev", "-H", "127.0.0.1", "-p", String(PORT)],
  {
    env: {
      ...process.env,
      DATABASE_URL: url,
      NEXT_TELEMETRY_DISABLED: "1",
      // its own build folder, so it runs even while your app is running
      NEXT_DIST_DIR: ".next-demo",
    },
    stdio: "ignore",
  },
)
const stop = () => server.kill("SIGTERM")
process.on("exit", stop)

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/write`)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error("The temporary server didn't start")
}

async function call(method, route, body) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    // deleting is only allowed from the app's own pages
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${route}: ${data.error ?? res.status}`)
  return data
}

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

try {
  await waitForServer()
  if (command === "remove") {
    for (const id of existing) await call("DELETE", `/api/notes/${id}`)
    console.log(`Removed ${existing.length} demo entries.`)
  } else {
    for (const entry of DEMO_ENTRIES) {
      await call("POST", "/api/notes", {
        title: entry.title,
        content: entry.content,
        date: isoDaysAgo(entry.daysAgo),
        tags: MARK,
        // saving queues background analysis; only when asked for
        analyze,
      })
    }
    console.log(`Added ${DEMO_ENTRIES.length} made-up entries.`)
    if (analyze) {
      for (;;) {
        const { pending } = await (
          await fetch(`${BASE}/api/analysis/status`)
        ).json()
        process.stdout.write(
          `\rAnalyzing… ${DEMO_ENTRIES.length - pending.length}/${DEMO_ENTRIES.length}`,
        )
        if (pending.length === 0) break
        await new Promise((r) => setTimeout(r, 2000))
      }
      console.log("\nFilling in tone and embeddings…")
      await call("POST", "/api/notes/classify")
      await call("POST", "/api/embeddings")
    }
    console.log("Done. Remove them any time with `npm run demo:remove`.")
  }
} finally {
  stop()
}
