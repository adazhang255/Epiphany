import { randomUUID } from "node:crypto"

// Undo for deletes. Whatever deletes something registers how to put it back
// and gets a token; the page shows "… · Undo", and POST /api/undo with the
// token restores it. What it restores (the deleted rows) stays on the server,
// in memory, for a while (gone after a restart).

const KEEP_MS = 15 * 60 * 1000

type Undo = { label: string; restore: () => Promise<unknown>; until: number }

const store = globalThis as unknown as { __undo?: Map<string, Undo> }
const undos: Map<string, Undo> = (store.__undo ??= new Map())

export function offerUndo(label: string, restore: () => Promise<unknown>) {
  const now = Date.now()
  for (const [token, u] of undos) if (u.until < now) undos.delete(token)
  const token = randomUUID()
  undos.set(token, { label, restore, until: now + KEEP_MS })
  return token
}

// Put it back. null if the token is unknown or too old (each works once).
export async function runUndo(token: string) {
  const undo = undos.get(token)
  undos.delete(token)
  if (!undo || undo.until < Date.now()) return null
  await undo.restore()
  return undo.label
}
