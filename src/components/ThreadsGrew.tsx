"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { usePublicView } from "@/components/usePublicView"
import {
  lastSeen,
  markSeen,
  THREADS_SEEN_EVENT,
} from "@/components/threadsSeen"

// Beside Threads in the nav: how many threads your writing has added to
// since you last looked ("2 grew"). Checked on each page change and when
// you come back to the window, at most once a minute.
let cache: { since: number; at: number; grew: number } | null = null

export function ThreadsGrew() {
  const pathname = usePathname()
  const readOnly = usePublicView()
  const [grew, setGrew] = useState(0)

  useEffect(() => {
    if (readOnly) return
    let alive = true
    const check = async () => {
      if (pathname.startsWith("/threads")) return setGrew(0)
      const since = lastSeen()
      // first time here: count from now on
      if (!since) return markSeen()
      if (cache && cache.since === since && Date.now() - cache.at < 60_000)
        return setGrew(cache.grew)
      const res = await fetch(`/api/threads/grew?since=${since}`).catch(
        () => null,
      )
      if (!res?.ok || !alive) return
      const { grew } = (await res.json()) as { grew: number }
      cache = { since, at: Date.now(), grew }
      if (alive) setGrew(grew)
    }
    const seen = () => {
      cache = null
      setGrew(0)
    }
    void check()
    window.addEventListener("focus", check)
    window.addEventListener(THREADS_SEEN_EVENT, seen)
    return () => {
      alive = false
      window.removeEventListener("focus", check)
      window.removeEventListener(THREADS_SEEN_EVENT, seen)
    }
  }, [pathname, readOnly])

  if (grew === 0) return null
  return (
    <span
      title={`${grew} ${grew === 1 ? "thread" : "threads"} your writing added to since you last looked`}
      className="ml-auto flex items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ember"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember"
      />
      {grew} grew
    </span>
  )
}
