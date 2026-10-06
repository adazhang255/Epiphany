// A passage's `thread` field (on Quote and Question):
//   null / ""          grouped automatically by similarity
//   "none"             taken out of threads
//   "t-<id>"           in a thread you arranged
//   "t-<id>::<name>"   ...that you also named
export const NONE = "none"

export type ParsedThread =
  | { kind: "auto" }
  | { kind: "none" }
  | { kind: "pinned"; id: string; name: string | null }

export function parseThread(value: string | null | undefined): ParsedThread {
  if (!value) return { kind: "auto" }
  if (value === NONE) return { kind: "none" }
  const at = value.indexOf("::")
  const id = at < 0 ? value : value.slice(0, at)
  const name = at < 0 ? "" : value.slice(at + 2).trim()
  return { kind: "pinned", id, name: name || null }
}

export const threadField = (id: string, name?: string | null) =>
  name ? `${id}::${name}` : id

// a name you typed, tidied: one line, at most 80 characters, no "::"
export const cleanThreadName = (raw: unknown) =>
  typeof raw === "string"
    ? raw.replace(/::/g, ":").replace(/\s+/g, " ").trim().slice(0, 80)
    : ""
