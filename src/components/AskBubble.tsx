"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// Ask, as a small round button in the bottom-right corner of every page
// (except Ask itself).
export function AskBubble() {
  const pathname = usePathname()
  if (pathname.startsWith("/ask")) return null
  return (
    <Link
      href="/ask"
      aria-label="Ask your journal"
      title="Ask your journal"
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-ember/40 bg-[#1a1a1b] text-ember shadow-lg shadow-black/50 transition hover:scale-105 hover:border-ember hover:bg-ember hover:text-stone-950"
    >
      <svg
        aria-hidden
        width="20"
        height="20"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 2.5v-2.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
      </svg>
    </Link>
  )
}
