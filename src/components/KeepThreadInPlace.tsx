"use client"

import { useLayoutEffect } from "react"

// After a change to a thread (say, adding a highlight), the list is rebuilt
// and the thread may land elsewhere in it, or come back under a new id.
// holdThread() notes where it was on screen; once the page has refreshed,
// <KeepThreadInPlace> scrolls so it sits at that same spot again.

let held: { id: string; top: number; until: number } | null = null

export function holdThread(id: string, from: Element | null) {
  const el = from?.closest("[data-thread]")
  if (!el) return
  held = { id, top: el.getBoundingClientRect().top, until: Date.now() + 5000 }
}

// `version` changes whenever the list does
export function KeepThreadInPlace({ version }: { version: string }) {
  useLayoutEffect(() => {
    if (!held) return
    if (Date.now() > held.until) {
      held = null
      return
    }
    const el = document.querySelector(`[data-thread="${CSS.escape(held.id)}"]`)
    if (!el) return
    window.scrollBy({
      top: el.getBoundingClientRect().top - held.top,
      behavior: "instant",
    })
    held = null
  }, [version])
  return null
}
