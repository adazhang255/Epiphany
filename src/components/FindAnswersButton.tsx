"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type Status = {
  running: boolean
  done: number
  total: number
  found: number
  error?: string
  finishedAt?: number
}

// Look through later entries for answers to your questions, with the local
// model, only when you press it (apart from highlights and tone). Answers
// are added under each question as Insight replies; nothing is closed.
function FindAnswersButtonInner() {
  const router = useRouter()
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState("")

  // pick up a run already going (e.g. after leaving and coming back)
  useEffect(() => {
    fetch("/api/questions/answers")
      .then((r) => r.json())
      .then((s: Status) => {
        if (s.running) setStatus(s)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!status?.running) return
    const timer = setInterval(async () => {
      const next: Status | null = await fetch("/api/questions/answers")
        .then((r) => r.json())
        .catch(() => null)
      if (!next) return
      setStatus(next)
      if (!next.running) router.refresh()
    }, 2000)
    return () => clearInterval(timer)
  }, [status?.running, router])

  async function start() {
    setError("")
    const res = await fetch("/api/questions/answers", { method: "POST" }).catch(
      () => null,
    )
    if (!res?.ok) {
      setError("Could not reach the server.")
      return
    }
    setStatus(await res.json())
  }

  const running = status?.running

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-panel px-4 py-3 text-sm">
      <button
        type="button"
        onClick={start}
        disabled={running}
        className="rounded-full bg-ink px-4 py-1.5 font-medium text-stone-900 disabled:opacity-50"
      >
        {running ? "Looking…" : "Find answers"}
      </button>
      <span className="min-w-0 flex-1 text-stone-400">
        {running
          ? `Checked ${status!.done} of ${status!.total} questions · ${status!.found} ${status!.found === 1 ? "answer" : "answers"} found so far. You can leave this page.`
          : status?.finishedAt
            ? status.error
              ? `Stopped: ${status.error}`
              : `Done: ${status.found} new ${status.found === 1 ? "answer" : "answers"} found.`
            : "Reads your later entries with the local model on this computer, looking for passages that answer each question. Answers are added below the question as Insights. Runs on its own, apart from highlights and tone."}
      </span>
      {error && <span className="w-full text-xs text-rose-300">{error}</span>}
    </div>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function FindAnswersButton() {
  return usePublicView() ? null : <FindAnswersButtonInner />
}
