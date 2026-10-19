"use client"

import { useCallback, useEffect, useRef } from "react"

// Unsaved writing is kept in this browser as you type, so leaving the page
// (a stray click, a link, a reload, a crash) never loses it: coming back
// brings it back. It's cleared once the entry is saved or you discard it.
// Stays on this computer, like the journal itself.

// the new entry being written (shared by Write and the notebook's blank page)
export const NEW_ENTRY_DRAFT = "draft:new-entry"
export type NewEntryDraft = {
  title: string
  date: string
  content: string
  // chosen on the notebook's blank page
  categories?: string[]
  tone?: number | null
  marks?: { key: string; category: string }[]
  ranges?: Record<string, { start: number; end: number }>
}
// changes to an entry not yet saved
export const entryDraftKey = (id: string) => `draft:entry:${id}`

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveDraft(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {}
}

// Keep `value` saved under `key` (a moment after the last change, and right
// away when the page is hidden or left); `null` means nothing worth keeping,
// so the saved draft goes. Does nothing until `ready` (the saved draft has
// been brought back). `value` should only change when the writing does
// (useMemo). Returns clear(): forget the draft (once it's saved, or
// discarded) until the next change.
export function useDraftAutosave(key: string, value: unknown, ready: boolean) {
  const latest = useRef({ key, value, ready })
  const cleared = useRef(false)
  const write = useCallback(() => {
    const { key, value, ready } = latest.current
    if (!ready || cleared.current) return
    if (value === null) clearDraft(key)
    else saveDraft(key, value)
  }, [])

  useEffect(() => {
    latest.current = { key, value, ready }
    cleared.current = false
    const t = setTimeout(write, 300)
    return () => clearTimeout(t)
  }, [key, value, ready, write])

  // whatever was typed in the last moment, when leaving
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") write()
    }
    window.addEventListener("pagehide", write)
    document.addEventListener("visibilitychange", onHide)
    return () => {
      write() // leaving the page within the app
      window.removeEventListener("pagehide", write)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [write])

  return useCallback(() => {
    cleared.current = true
    clearDraft(latest.current.key)
  }, [])
}

// The browser's "Leave site? Changes you made may not be saved." when
// closing or reloading the tab with unsaved writing.
export function useUnsavedWarning(unsaved: boolean) {
  useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [unsaved])
}

export const confirmDiscard = (what = "this writing") =>
  window.confirm(`Discard ${what}? It can't be brought back.`)
