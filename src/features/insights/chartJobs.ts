import { parseSpec, type ChartSpec } from "@/features/insights/spec"
import { chartSpecFor } from "@/features/insights/askChart"

// Charts asked for on the Custom page, made in the background: asking adds
// the question here and returns at once, the local model works through them
// one at a time, and the page (and the header) check back. Finished ones are
// kept until you dismiss them, for this server's lifetime (a restart forgets
// them; pinned charts are saved for good).

export type ChartJob = {
  id: string
  question: string
  state: "queued" | "running" | "done" | "error"
  spec: ChartSpec | null
  error: string | null
  askedAt: number
  finishedAt: number | null
}

// most finished ones kept (oldest dismissed first)
const KEEP = 20

const store = globalThis as unknown as {
  __chartJobs?: { list: ChartJob[]; working: boolean }
}
const state = (store.__chartJobs ??= { list: [], working: false })

export const chartJobs = (): ChartJob[] => state.list

export function askForChart(question: string): ChartJob {
  const job: ChartJob = {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    question,
    state: "queued",
    spec: null,
    error: null,
    askedAt: Date.now(),
    finishedAt: null,
  }
  state.list.push(job)
  const finished = state.list.filter(
    (j) => j.state === "done" || j.state === "error",
  )
  for (const old of finished.slice(0, Math.max(0, finished.length - KEEP)))
    dismissChart(old.id)
  void work()
  return job
}

export function dismissChart(id: string) {
  const job = state.list.find((j) => j.id === id)
  // one being made finishes first (the model can't be interrupted midway)
  if (!job || job.state === "running") return false
  state.list = state.list.filter((j) => j.id !== id)
  return true
}

// one at a time: the local model handles a single request well
async function work() {
  if (state.working) return
  state.working = true
  try {
    for (;;) {
      const job = state.list.find((j) => j.state === "queued")
      if (!job) break
      job.state = "running"
      try {
        job.spec = parseSpec(await chartSpecFor(job.question))
        job.state = "done"
      } catch (error) {
        job.error = (error as Error).message || "Couldn't make that chart."
        job.state = "error"
      }
      job.finishedAt = Date.now()
    }
  } finally {
    state.working = false
  }
}
