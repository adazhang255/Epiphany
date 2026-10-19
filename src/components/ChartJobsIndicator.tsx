"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Walker } from "@/components/DraggableTimeline"
import { usePublicView } from "@/components/usePublicView"
import { useChartJobs } from "@/components/useChartJobs"
import type { ChartJob } from "@/features/insights/chartJobs"

// A small header indicator for charts being made in the background (asked
// for on Custom), so you can be anywhere while they're made: "Making chart",
// then "Chart ready" for a moment, linking to it. Not shown on Custom itself,
// which lists them.
function ChartJobsIndicatorInner() {
  const onCustom = usePathname().startsWith("/custom")
  const [ready, setReady] = useState<ChartJob | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { jobs } = useChartJobs(true, (_, finished) => {
    const last = finished.at(-1)
    if (!last) return
    setReady(last)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setReady(null), 8000)
  })
  useEffect(() => () => clearTimeout(timer.current), [])

  if (onCustom) return null
  const making = jobs.filter(
    (j) => j.state === "queued" || j.state === "running",
  )
  if (making.length > 0) {
    return (
      <Link
        href="/custom"
        role="status"
        title={`Making a chart for “${making[0].question}”`}
        className="flex shrink-0 items-center gap-1 rounded-full border border-ember/30 bg-ember/[0.06] py-0.5 pl-1 pr-3 text-xs text-stone-300"
      >
        <span className="-my-1 scale-[0.7]">
          <Walker walking flipped={false} />
        </span>
        Making chart
        {making.length > 1 && (
          <span className="text-stone-500">· {making.length}</span>
        )}
      </Link>
    )
  }
  if (ready) {
    return (
      <Link
        href={
          ready.state === "done"
            ? `/custom?chart=${encodeURIComponent(ready.id)}`
            : "/custom"
        }
        role="status"
        className="save-toast flex shrink-0 items-center gap-1.5 rounded-full border border-ember/30 px-3 py-1 text-xs text-stone-300"
      >
        <span className="text-ember">✓</span>
        {ready.state === "done"
          ? "Chart ready"
          : "Couldn’t make the chart (is Ollama running?)"}
      </Link>
    )
  }
  return null
}

// Uses the local AI, so it isn't part of the read-only public site.
export function ChartJobsIndicator() {
  return usePublicView() ? null : <ChartJobsIndicatorInner />
}
