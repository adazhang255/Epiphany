"use client"

import { useSyncExternalStore } from "react"
import { PUBLIC_SITE } from "@/lib/site-mode"

const noChanges = () => () => {}

// Read-only, as on the public site: on the public site itself, and in the
// Publish page's preview (a page opened in its frame with ?preview=1).
export function usePublicView() {
  const previewing = useSyncExternalStore(
    noChanges,
    () =>
      window.self !== window.top &&
      new URLSearchParams(window.location.search).has("preview"),
    () => false,
  )
  return PUBLIC_SITE || previewing
}
