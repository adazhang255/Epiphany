"use client"

import { useEffect, useState } from "react"
import { quickScroll } from "@/lib/quickScroll"

// "↑ Top" at the foot of a long page (Highlights, Notebook, Threads), once
// you've scrolled a screen and a half down; above the Ask button.
export function BackToTop() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const check = () => setShown(window.scrollY > window.innerHeight * 1.5)
    check()
    window.addEventListener("scroll", check, { passive: true })
    return () => window.removeEventListener("scroll", check)
  }, [])
  return (
    <button
      type="button"
      onClick={() => quickScroll(0)}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={shown ? 0 : -1}
      className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-stone-900/90 text-stone-300 shadow-lg shadow-black/40 backdrop-blur transition hover:border-ember/50 hover:text-ember ${
        shown ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
      </svg>
    </button>
  )
}
