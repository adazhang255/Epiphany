"use client"

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"

// Unsaved writing is kept in this browser as you type, so leaving the page
// (a stray click, a link, a reload, a crash) never loses it: coming back
// brings it back. It's cleared once the entry is saved or you discard it.
// Stays on this computer, like the journal itself.

// the new entry being written (shared by Write and the notebook's blank page)
export const NEW_ENTRY_DRAFT = "draft:new-entry"
export type NewEntryDraft = {
  title: string
  date: string
  time?: string // "HH:MM" (Write only)
  content: string
  categories?: string[]
  tone?: number | null
  // marked on the notebook's blank page
  marks?: { key: string; category: string }[]
  ranges?: Record<string, { start: number; end: number }>
}

// Several new entries can be on the go at once: the first (the one the
// notebook's blank page shares) under NEW_ENTRY_DRAFT, the others under
// NEW_ENTRY_DRAFT + ":" + an id of their own, made when started (so they
// sort oldest first). The Write page shows one at a time, by ?draft=id.
export const newEntryDraftKey = (id = "") =>
  id ? `${NEW_ENTRY_DRAFT}:${id}` : NEW_ENTRY_DRAFT
export const newDraftId = () => Date.now().toString(36)
export const writeHref = (id = "") =>
  id ? `/write?draft=${encodeURIComponent(id)}` : "/write"

export type DraftSummary = { id: string; draft: NewEntryDraft }

// told when a draft is kept or cleared, here or in another tab
const DRAFTS_EVENT = "drafts-change"
function subscribe(onChange: () => void) {
  window.addEventListener(DRAFTS_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(DRAFTS_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}
let seen = ""
let summaries: DraftSummary[] = []
function readDrafts() {
  const found: [string, string][] = []
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key === NEW_ENTRY_DRAFT || key?.startsWith(`${NEW_ENTRY_DRAFT}:`))
        found.push([key, window.localStorage.getItem(key) ?? ""])
    }
  } catch {}
  found.sort(([a], [b]) => a.length - b.length || (a < b ? -1 : 1))
  const raw = JSON.stringify(found)
  if (raw === seen) return summaries
  seen = raw
  summaries = found.flatMap(([key, value]) => {
    try {
      const draft = JSON.parse(value) as NewEntryDraft
      return [{ id: key.slice(NEW_ENTRY_DRAFT.length + 1), draft }]
    } catch {
      return []
    }
  })
  return summaries
}
const none: DraftSummary[] = []

// the new entries being written, kept in this browser (oldest first)
export function useNewEntryDrafts() {
  return useSyncExternalStore(subscribe, readDrafts, () => none)
}

// a draft's name in a list: its title, or how it starts
export function draftName(draft: NewEntryDraft | null | undefined) {
  const title = draft?.title?.trim()
  if (title) return title
  const words = draft?.content?.trim().split(/\s+/).slice(0, 5).join(" ")
  return words ? `${words}…` : "New draft"
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
  window.dispatchEvent(new Event(DRAFTS_EVENT))
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {}
  window.dispatchEvent(new Event(DRAFTS_EVENT))
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
