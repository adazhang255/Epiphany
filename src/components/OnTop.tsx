"use client"

import { useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

const noChanges = () => () => {}

// Draws its children on a layer above the whole page (positioned in page
// coordinates), so a floating menu is never hidden under buttons, the next
// notebook page, or anything else drawn after the spot it belongs to.
export function OnTop({ children }: { children: React.ReactNode }) {
  // only in the browser: there's no page to draw on while rendering on the
  // server
  const inBrowser = useSyncExternalStore(
    noChanges,
    () => true,
    () => false,
  )
  return inBrowser ? createPortal(children, document.body) : null
}
