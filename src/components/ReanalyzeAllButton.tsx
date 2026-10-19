"use client"

import { usePublicView } from "@/components/usePublicView"
import { useState } from "react"
import { announceAnalysis, useAnalysisBusy } from "@/components/useAnalysisBusy"

// Re-read every entry for highlights with the local model (Ollama, on this
// computer), after asking. Highlights the AI made are replaced; ones you
// marked yourself are kept. Progress shows in the header.
function ReanalyzeAllButtonInner({ noteIds }: { noteIds: string[] }) {
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState("")
  // greyed out while any highlights are being found (this run or another)
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
    setAsking(false)
    announceAnalysis()
  }

  if (!asking || busy) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={busy}
        title={
          busy
            ? "Highlights are being found right now; this is available again when that's done (progress at the top of the page)"
            : undefined
        }
        className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-sm text-stone-400 transition hover:border-white/25 hover:text-stone-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-stone-400"
      >
        <span aria-hidden className={busy ? "animate-spin" : ""}>
          ↻
        </span>{" "}
        {busy ? "Finding highlights…" : "Re-analyze highlights"}
      </button>
    )
  }

  return (
    <div
      role="alertdialog"
      aria-label="Re-analyze every entry?"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-ember/30 bg-ember/[0.05] px-4 py-3 text-sm text-stone-300"
    >
      <span className="min-w-0 flex-1">
        This sends all {noteIds.length} entries, one at a time, to the local
        model on this computer to find highlights again. Highlights the AI made
        are replaced; ones you marked yourself are kept.
      </span>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="rounded-full border border-white/15 px-3 py-1 text-stone-300 hover:bg-white/5"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={run}
        className="rounded-full bg-ember px-3 py-1 font-medium text-stone-950"
      >
        Re-analyze {noteIds.length}
      </button>
      {error && <span className="w-full text-xs text-rose-300">{error}</span>}
    </div>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function ReanalyzeAllButton(
  props: React.ComponentProps<typeof ReanalyzeAllButtonInner>,
) {
  return usePublicView() ? null : <ReanalyzeAllButtonInner {...props} />
}
