"use client"

import { useSyncExternalStore } from "react"

// Thread titles the local model wrote while the page was open (each thread's
// <ThreadTitle> asks for its own), shared so the list of topics at the top
// of the page can show them too. Keyed by thread id.
const titles = new Map<string, string>()
const listeners = new Set<() => void>()

export function shareThreadTitle(id: string, title: string) {
  if (titles.get(id) === title) return
  titles.set(id, title)
  for (const l of listeners) l()
}

export function useThreadTitle(id: string) {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => titles.get(id) ?? null,
    () => null,
  )
}
