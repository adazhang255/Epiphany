"use client"

import { useEffect } from "react"
import { quickScrollTo } from "@/lib/quickScroll"

// Centre the highlight the reader clicked on the timeline.
export function ScrollToHighlight({ id }: { id: string }) {
  useEffect(() => {
    const el = document.getElementById(`h-${id}`)
    if (el) quickScrollTo(el, "center")
  }, [id])

  return null
}
