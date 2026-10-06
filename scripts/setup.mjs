// First-time setup for your own copy: settings, an empty journal, and a check
// that the local AI models are there. Safe to run again: it never touches an
// existing journal or settings file.
//   npm run setup
import { execSync } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"

const MODELS = ["llama3.2", "gemma3:4b", "nomic-embed-text"]

// 1. settings
if (existsSync(".env.local")) {
  console.log("✓ .env.local already exists (left as it is)")
} else {
  writeFileSync(
    ".env.local",
    `DATABASE_URL="file:./dev.db"
OLLAMA_MODEL="llama3.2:latest"            # reads entries: highlights, categories
OLLAMA_CHART_MODEL="gemma3:4b"            # picks charts on Custom; answers Ask
# OLLAMA_EMBED_MODEL="nomic-embed-text"   # default; powers Threads and search
# OLLAMA_HOST="http://127.0.0.1:11434"    # default; must be this computer
# PUBLISH_DIR="public-site"               # default; where your public site is built
`,
  )
  console.log("✓ Created .env.local")
}

// 2. your journal: an empty database (dev.db), git-ignored
const fresh = !existsSync("dev.db")
execSync("npx prisma db push", {
  stdio: "ignore",
  env: { ...process.env, DATABASE_URL: "file:./dev.db" },
})
execSync("npx prisma generate", { stdio: "ignore" })
console.log(
  fresh
    ? "✓ Created your journal (dev.db). It stays on this computer."
    : "✓ Your journal (dev.db) is up to date",
)

// 3. the local models (nothing is sent anywhere else)
let have = null
try {
  have = execSync("ollama list", { encoding: "utf8" })
} catch {}
if (have === null) {
  console.log(
    "• Ollama isn't installed or running. Install it from https://ollama.com, run `ollama serve`, then:",
  )
  for (const m of MODELS) console.log(`    ollama pull ${m}`)
} else {
  const missing = MODELS.filter((m) => !have.includes(m.split(":")[0]))
  if (missing.length === 0) console.log("✓ Ollama models are ready")
  else {
    console.log("• Download the models the app uses:")
    for (const m of missing) console.log(`    ollama pull ${m}`)
  }
}

console.log(`
Next:
  npm run dev           start the app → http://127.0.0.1:3000
  npm run demo:add      optional: add made-up entries to try it out
  npm run demo:remove   take the made-up entries out again`)
