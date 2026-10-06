"use client"

import { useEffect } from "react"
import { HOLD_Y } from "@/components/DraggableTimeline"

// Arriving at a day on the timeline (e.g. from a square on Stats, /#d-…),
// centre it on the screen and outline it for a moment so it's easy to spot.
// Clicking a day's dot instead brings that dot to the middle of the screen,
// into the walker's hands, so he ends up holding it.
export function ScrollToDay() {
  useEffect(() => {
    function go(hash = window.location.hash, toWalker = false) {
      const id = decodeURIComponent(hash.slice(1))
      if (!id.startsWith("d-")) return
      const day = document.getElementById(id)
      if (!day) return
      // after the browser's own jump to the anchor, re-place it centred
      requestAnimationFrame(() => {
        const dot = day.querySelector("[data-day-dot]")
        if (toWalker && dot) {
          // once the scroll stops, the walker sees the dot in reach and holds it
          const r = dot.getBoundingClientRect()
          const hands = window.innerHeight / 2 + HOLD_Y
          window.scrollBy({
            top: r.top + r.height / 2 - hands,
            behavior: "smooth",
          })
          return // the walker holding it is marker enough; no outline
        }
        day.scrollIntoView({ behavior: "smooth", block: "center" })
        day.classList.remove("jump-target")
        void day.offsetWidth // restart the glow if it's already there
        day.classList.add("jump-target")
        window.setTimeout(() => day.classList.remove("jump-target"), 1800)
      })
    }
    go()
    const onHash = () => go()
    // a day's dot: hand it to the walker (even if it's the day already in
    // the address)
    const onClick = (e: MouseEvent) => {
      const dot = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        "a[data-day-dot]",
      )
      if (!dot) return
      e.preventDefault()
      const hash = dot.getAttribute("href")!
      history.replaceState(null, "", hash)
      go(hash, true)
    }
    window.addEventListener("hashchange", onHash)
    document.addEventListener("click", onClick)
    return () => {
      window.removeEventListener("hashchange", onHash)
      document.removeEventListener("click", onClick)
    }
  }, [])

  return null
}
