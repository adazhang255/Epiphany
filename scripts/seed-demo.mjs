// Build demo.db from made-up entries, for testing without touching your
// journal. Usage:
//   npm run demo:seed              entries only
//   npm run demo:seed -- --analyze entries + highlights, categories, tone,
//                                  embeddings (needs `ollama serve`)
// Then: npm run dev:demo  →  http://localhost:3001
import { execSync, spawn } from "node:child_process"
import { existsSync, rmSync } from "node:fs"
import path from "node:path"
import { DEMO_ENTRIES } from "./demo-entries.mjs"

const DEMO_DB = "demo.db"
const PORT = 3099
const BASE = `http://127.0.0.1:${PORT}`
const analyze = process.argv.includes("--analyze")

// Never touch anything but demo.db.
const target = path.resolve(DEMO_DB)
if (path.basename(target) !== "demo.db")
  throw new Error("Refusing to seed anything but demo.db")
if (existsSync(target)) rmSync(target)

const env = {
  ...process.env,
  DATABASE_URL: `file:./${DEMO_DB}`,
  NEXT_TELEMETRY_DISABLED: "1",
}
console.log("Creating demo.db…")
execSync("npx prisma db push", { env, stdio: "ignore" })

console.log("Starting a temporary server on the demo database…")
const server = spawn(
  "npx",
  ["next", "dev", "-H", "127.0.0.1", "-p", String(PORT)],
  {
    env,
    stdio: "ignore",
  },
)
const stop = () => server.kill("SIGTERM")
process.on("exit", stop)

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${BASE}/write`)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error("Demo server didn't start")
}

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

async function post(url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${url}: ${data.error ?? res.status}`)
  return data
}

try {
  await waitForServer()
  const ids = []
  for (const entry of DEMO_ENTRIES) {
    const note = await post("/api/notes", {
      title: entry.title,
      content: entry.content,
      date: isoDaysAgo(entry.daysAgo),
      // saving queues background analysis; only when asked for
      analyze,
    })
    ids.push(note.id)
  }
  console.log(`Added ${ids.length} made-up entries.`)

  if (analyze) {
    // the server reads them one by one in the background; wait for it
    for (;;) {
      const res = await fetch(`${BASE}/api/analysis/status`)
      const { pending } = await res.json()
      process.stdout.write(
        `\rAnalyzing… ${ids.length - pending.length}/${ids.length}`,
      )
      if (pending.length === 0) break
      await new Promise((r) => setTimeout(r, 2000))
    }
    console.log("\nFilling in tone and embeddings…")
    await post("/api/notes/classify")
    await post("/api/embeddings")
  }
  console.log("Done. Run `npm run dev:demo` and open http://localhost:3001")
} finally {
  stop()
}
