import { categoryColor, highlightType } from "@/features/notes/lib/topics"

// Highlights in text being edited: where each one is, kept in step with the
// edits, and the text cut into plain and highlighted runs for drawing a
// tinted copy under a text box. Used by the entry editor and the notebook's
// blank page.

// hex color + alpha → rgba, for tinting a highlight
export function tint(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export type Range = { start: number; end: number }

// Move the highlights along with one edit (old text → new text). Typing
// inside a highlight grows it, deleting shrinks it; typing just before or
// after one only moves it. An edit that replaces part of one (a paste, an
// undo, typing over a selection) trims it to the words it still has: it
// never spreads over the new text. One whose words are all gone is dropped.
export function follow(
  ranges: Record<string, Range>,
  before: string,
  after: string,
) {
  let p = 0
  const max = Math.min(before.length, after.length)
  while (p < max && before[p] === after[p]) p++
  let s = 0
  while (
    s < max - p &&
    before[before.length - 1 - s] === after[after.length - 1 - s]
  )
    s++
  const start = p
  const oldEnd = before.length - s
  const newEnd = after.length - s
  const delta = newEnd - oldEnd

  const next: Record<string, Range> = {}
  for (const [id, { start: a, end: b }] of Object.entries(ranges)) {
    let range: Range
    if (oldEnd <= a && start < a)
      range = { start: a + delta, end: b + delta } // all before it
    else if (start === oldEnd && start === a)
      range = { start: a + delta, end: b + delta } // typed right at its start
    else if (start >= b)
      range = { start: a, end: b } // all after it
    else if (start <= a && oldEnd >= b)
      // replaced all of it (or an undo or paste swapped text around it):
      // keep it only if its words are still there, nearest where it was
      range = refind(before.slice(a, b), after, a) ?? { start: 0, end: 0 }
    else if (start >= a && oldEnd <= b)
      range = { start: a, end: b + delta } // inside it: grows or shrinks
    else if (start < a && oldEnd < b)
      range = { start: newEnd, end: b + delta } // took its start
    else range = { start: a, end: start } // took its end
    if (range.end > range.start) next[id] = range
  }
  return next
}

// where `words` now are in `text`: the copy nearest `near`
function refind(words: string, text: string, near: number): Range | null {
  let best: number | null = null
  for (let i = text.indexOf(words); i >= 0; i = text.indexOf(words, i + 1))
    if (best === null || Math.abs(i - near) < Math.abs(best - near)) best = i
  return best === null ? null : { start: best, end: best + words.length }
}

// The text being edited, cut into plain runs and highlighted ones.
export function markUp(
  text: string,
  items: { id: string; category: string }[],
  ranges: Record<string, Range>,
) {
  const found = items
    .filter((h) => ranges[h.id])
    .map((h) => ({ h, range: ranges[h.id] }))
    .sort((a, b) => a.range.start - b.range.start)
  const parts: { text: string; color?: string }[] = []
  let at = 0
  for (const { h, range } of found) {
    if (range.start < at) continue // overlaps one already drawn
    if (range.start > at) parts.push({ text: text.slice(at, range.start) })
    parts.push({
      text: text.slice(range.start, range.end),
      color: categoryColor(highlightType(h.category)),
    })
    at = range.end
  }
  parts.push({ text: text.slice(at) })
  return parts
}
