import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

// The Ask conversation, saved on this computer (in the app's git-ignored
// .cache folder) rather than in the browser, so it's still there in another
// browser, a private window, at localhost or 127.0.0.1, or after the browser
// clears site data. One per database, so the demo never shows your real one.
// /new clears it.

function file() {
  const db = path
    .basename(
      (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, ""),
    )
    .replace(/\.db$/, "")
    .replace(/[^\w-]/g, "_")
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ".cache",
    `ask-conversation-${db}.json`,
  )
}

// most turns kept (the oldest go first)
const KEEP = 400
export const MAX_BYTES = 4 * 1024 * 1024

export async function readConversation(): Promise<unknown[]> {
  try {
    const saved = JSON.parse(await readFile(file(), "utf8"))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export async function saveConversation(turns: unknown[]) {
  if (turns.length === 0) {
    await rm(file(), { force: true })
    return
  }
  await mkdir(path.dirname(file()), { recursive: true })
  // written whole, then moved into place, so a crash can't leave half a file
  const tmp = `${file()}.tmp`
  await writeFile(tmp, JSON.stringify(turns.slice(-KEEP)))
  await rename(tmp, file())
}
