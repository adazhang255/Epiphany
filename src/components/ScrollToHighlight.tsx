"use client"

import { useEffect } from "react"

// Centre the highlight the reader clicked on the timeline.
export function ScrollToHighlight({ id }: { id: string }) {
  useEffect(() => {
    document
      .getElementById(`h-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [id])

  return null
}
