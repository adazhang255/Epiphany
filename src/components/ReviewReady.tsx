"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { usePublicView } from "@/components/usePublicView"
import { REVIEW_SEEN_EVENT, reviewWaiting } from "@/components/reviewSeen"

// Beside Stats in the nav, in December until you've looked: "2026 ready",
// for this year's review.
export function ReviewReady() {
  const pathname = usePathname()
  const readOnly = usePublicView()
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    if (readOnly) return
    const check = () => setWaiting(reviewWaiting())
    check()
    window.addEventListener("focus", check)
    window.addEventListener(REVIEW_SEEN_EVENT, check)
    return () => {
      window.removeEventListener("focus", check)
      window.removeEventListener(REVIEW_SEEN_EVENT, check)
    }
  }, [pathname, readOnly])

  if (!waiting) return null
  const year = new Date().getFullYear()
  return (
    <span
      title={`Your ${year} in review is ready, on Stats`}
      className="ml-auto flex items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ember"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember"
      />
      {year} ready
    </span>
  )
}
