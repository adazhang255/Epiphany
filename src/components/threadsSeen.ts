"use client"

// When you last looked at the Threads page, kept in this browser (threads
// that grew since then are counted in the nav and marked on the page).

const KEY = "threads:seenAt"
export const THREADS_SEEN_EVENT = "threads:seen"

export function lastSeen(): number | null {
  try {
    const n = Number(localStorage.getItem(KEY))
    return n > 0 ? n : null
  } catch {
    return null
  }
}

export function markSeen(at = Date.now()) {
  try {
    localStorage.setItem(KEY, String(at))
  } catch {
    // (storage blocked: the count just won't show)
  }
  window.dispatchEvent(new Event(THREADS_SEEN_EVENT))
}
