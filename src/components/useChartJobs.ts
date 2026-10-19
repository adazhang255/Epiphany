"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ChartJob } from "@/features/insights/chartJobs"

// Charts being made in the background (see chartJobs), for the Custom page
// and the header. Checks once, then every couple of seconds while any is
// still queued or being made.

// sent when a chart is asked for, so the header starts watching at once
export const CHART_EVENT = "charts:queued"

const pending = (jobs: ChartJob[]) =>
  jobs.some((j) => j.state === "queued" || j.state === "running")

// `onUpdate` hears each check: the jobs, the ones that finished since the
// last check, and whether this was the first.
export type ChartJobsUpdate = (
  jobs: ChartJob[],
  finished: ChartJob[],
  first: boolean,
) => void

export function useChartJobs(enabled = true, onUpdate?: ChartJobsUpdate) {
  const [jobs, setJobs] = useState<ChartJob[]>([])
  const listener = useRef(onUpdate)
  useEffect(() => {
    listener.current = onUpdate
  })
  // ids still waiting at the last check (null before the first)
  const waiting = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    async function check() {
      clearTimeout(timer)
      const res = await fetch("/api/explore", { cache: "no-store" }).catch(
        () => null,
      )
      const data = res?.ok ? await res.json().catch(() => null) : null
      if (!data || !alive) return
      const next: ChartJob[] = data.jobs ?? []
      const first = waiting.current === null
      const finished = next.filter(
        (j) =>
          waiting.current?.has(j.id) &&
          (j.state === "done" || j.state === "error"),
      )
      waiting.current = new Set(
        next
          .filter((j) => j.state === "queued" || j.state === "running")
          .map((j) => j.id),
      )
      setJobs(next)
      listener.current?.(next, finished, first)
      if (pending(next)) timer = setTimeout(check, 2000)
    }
    void check()
    const onQueued = () => setTimeout(check, 200)
    window.addEventListener(CHART_EVENT, onQueued)
    return () => {
      alive = false
      clearTimeout(timer)
      window.removeEventListener(CHART_EVENT, onQueued)
    }
  }, [enabled])

  // ask for a chart; returns the new job (or an error message)
  const ask = useCallback(
    async (question: string): Promise<ChartJob | string> => {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      }).catch(() => null)
      const data = await res?.json().catch(() => null)
      if (!res?.ok || !data?.job)
        return data?.error ?? "Couldn't reach the app."
      setJobs((all) => [...all, data.job])
      waiting.current?.add(data.job.id)
      window.dispatchEvent(new Event(CHART_EVENT))
      return data.job as ChartJob
    },
    [],
  )

  const dismiss = useCallback(async (id: string) => {
    setJobs((all) => all.filter((j) => j.id !== id))
    await fetch(`/api/explore?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => null)
  }, [])

  return { jobs, ask, dismiss }
}
