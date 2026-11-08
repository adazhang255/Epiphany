// Quotes you keep: what the page and the server share (no database here,
// so the browser can use it too).

export type KeptQuote = {
  id: string
  text: string
  author: string
  source: string
  note: string
  createdAt: string
}

// One of them for the day: the same all day, a different one tomorrow.
export function quoteForDay<T>(list: T[], day: string): T | null {
  if (list.length === 0) return null
  let hash = 0
  for (const c of day) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return list[hash % list.length]
}
