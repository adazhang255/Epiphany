"use client"

import { useSyncExternalStore } from "react"

// The order of the Threads page, held after you change a thread there
// (rename it, take a passage out), so the thread you changed, and the
// others, stay where they were until you leave or reload the page. A
// change can give a thread a new id (an automatic one becomes yours):
// it keeps its place under the new one.

let shown: string[] = [] // the order on screen now
let held: string[] | null = null
// old id → new, for threads that got a new id while you were here
const aliases = new Map<string, string>()
const listeners = new Set<() => void>()

export function noteShownOrder(ids: string[]) {
  shown = ids
}

export function holdOrder(was?: string, now?: string) {
  const base = held ?? shown
  if (was && now && was !== now) aliases.set(was, now)
  held = was && now ? base.map((id) => (id === was ? now : id)) : [...base]
  for (const l of listeners) l()
}

export function releaseOrder() {
  if (!held) return
  held = null
  aliases.clear()
  for (const l of listeners) l()
}

export function useHeldOrder() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => held,
    () => null,
  )
}

// `items` in the held order. Ones not in it (a thread that formed since)
// keep their place after the thread they followed.
export function inHeldOrder<T extends { id: string }>(
  items: T[],
  order: string[] | null,
) {
  if (!order) return items
  const rank = new Map(order.map((id, i) => [id, i]))
  let last = -1
  const key = new Map<string, number>()
  items.forEach((t, i) => {
    const r = rank.get(t.id)
    if (r !== undefined) last = r
    key.set(t.id, r ?? last + (i + 1) / (items.length + 1))
  })
  return items.toSorted((a, b) => key.get(a.id)! - key.get(b.id)!)
}

// a thread's id now, given the id it had (it may have had a new one since)
export function currentId(id: string) {
  const seen = new Set<string>()
  while (aliases.has(id) && !seen.has(id)) {
    seen.add(id)
    id = aliases.get(id)!
  }
  return id
}
