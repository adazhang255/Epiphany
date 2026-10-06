"use client"

import { useState } from "react"
import { announceAnalysis, useAnalysisBusy } from "@/components/useAnalysisBusy"

// Queues entries that haven't been read yet for background analysis; the
// header indicator shows progress, so you can leave this page.
export function AnalyzeAllButton({ noteIds }: { noteIds: string[] }) {
  const [queued, setQueued] = useState(false)
  const [error, setError] = useState("")
  const busy = useAnalysisBusy()

  if (noteIds.length === 0) return null

  async function run() {
    setError("")
    const res = await fetch("/api/analysis/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteIds }),
    }).catch(() => null)
    if (!res?.ok) {
      setError("Could not reach the server.")
      return
    }
    setQueued(true)
    announceAnalysis()
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-stone-400">
      <span>
        {noteIds.length}{" "}
        {noteIds.length === 1 ? "entry hasn't" : "entries haven't"} been read
        for highlights yet.
      </span>
      {queued ? (
        <span className="text-xs text-stone-400">
          Queued. Progress shows at the top of the page; feel free to move on.
        </span>
      ) : (
        <button
          type="button"
          onClick={run}
          disabled={busy}
          title={busy ? "Highlights are being found right now" : undefined}
          className="rounded-full border border-white/15 px-3 py-1 text-stone-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {busy ? "Finding highlights…" : "Analyze them"}
        </button>
      )}
      {error && (
        <span className="w-full text-xs text-rose-300/80">{error}</span>
      )}
    </div>
  )
}
