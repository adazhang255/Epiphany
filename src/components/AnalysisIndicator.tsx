"use client"

import { usePublicView } from "@/components/usePublicView"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Walker } from "@/components/DraggableTimeline"
import { titleText } from "@/features/notes/lib/titles"

type Status = {
  pending: { id: string; title: string }[]
  finished: {
    id: string
    title: string
    ok: boolean
    count: number
    at: number
  }[]
}

// Other components announce new background work with this event.
export const ANALYSIS_EVENT = "analysis:queued"

// A small header indicator for highlights being found in the background.
// Polls only while something is pending, then shows "ready" for a moment and
// refreshes the current page so the new highlights appear.
function AnalysisIndicatorInner() {
  const router = useRouter()
  const [status, setStatus] = useState<Status | null>(null)
  const [ready, setReady] = useState<Status["finished"][number] | null>(null)
  const wasPending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    async function check() {
      if (timer.current) clearTimeout(timer.current)
      const res = await fetch("/api/analysis/status", {
        cache: "no-store",
      }).catch(() => null)
      const next: Status | null = res?.ok ? await res.json() : null
      if (!next || !alive) return
      setStatus(next)
      if (next.pending.length > 0) {
        wasPending.current = true
        timer.current = setTimeout(check, 2000)
      } else if (wasPending.current) {
        wasPending.current = false
        setReady(next.finished[0] ?? null)
        router.refresh()
        timer.current = setTimeout(() => setReady(null), 5000)
      }
    }
    check()
    const onQueued = () => setTimeout(check, 300)
    window.addEventListener(ANALYSIS_EVENT, onQueued)
    return () => {
      alive = false
      window.removeEventListener(ANALYSIS_EVENT, onQueued)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [router])

  const pending = status?.pending ?? []
  if (pending.length > 0) {
    const first = pending[0]
    return (
      <Link
        href={`/notes/${first.id}`}
        role="status"
        title={`Finding highlights in “${titleText(first.title)}”`}
        className="flex shrink-0 items-center gap-1 rounded-full border border-ember/30 bg-ember/[0.06] py-0.5 pl-1 pr-3 text-xs text-stone-300"
      >
        <span className="-my-1 scale-[0.7]">
          <Walker walking flipped={false} />
        </span>
        Finding highlights
        {pending.length > 1 && (
          <span className="text-stone-500">· {pending.length}</span>
        )}
      </Link>
    )
  }
  if (ready) {
    return (
      <Link
        href={`/notes/${ready.id}`}
        role="status"
        className="save-toast flex shrink-0 items-center gap-1.5 rounded-full border border-ember/30 px-3 py-1 text-xs text-stone-300"
      >
        <span className="text-ember">✓</span>
        {ready.ok
          ? `Highlights ready${ready.count ? ` · ${ready.count}` : ""}`
          : "Couldn’t find highlights (is Ollama running?)"}
      </Link>
    )
  }
  return null
}

// Edits your journal, so it isn't part of the read-only public site.
export function AnalysisIndicator() {
  return usePublicView() ? null : <AnalysisIndicatorInner />
}
