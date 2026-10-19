"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { announceAnalysis, useAnalysisBusy } from "@/components/useAnalysisBusy"

function GenerateHighlightsButtonInner({
  noteId,
  hasHighlights,
}: {
  noteId: string
  hasHighlights: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")
  // greyed out while highlights are being found anywhere
  const busy = useAnalysisBusy()

  async function generate() {
    setPending(true)
    setMessage("")
    announceAnalysis()
    try {
      const res = await fetch("/api/notes/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? "Something went wrong.")
      } else if (data.count === 0) {
        setMessage(
          "The model found nothing it could quote word-for-word. Try again?",
        )
      } else {
        router.refresh()
      }
    } catch {
      setMessage("Could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={generate}
        disabled={pending || busy}
        title={
          busy && !pending
            ? "Highlights are being found right now; try again when that's done"
            : undefined
        }
        className="rounded-full border border-white/15 px-4 py-2 text-sm text-stone-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {pending
          ? "Reading your entry…"
          : busy
            ? "Finding highlights…"
            : hasHighlights
              ? "Regenerate highlights"
              : "Find highlights"}
      </button>
      {message && (
        <p className="mt-2 text-xs leading-relaxed text-rose-300/80">
          {message}
        </p>
      )}
    </div>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function GenerateHighlightsButton(
  props: React.ComponentProps<typeof GenerateHighlightsButtonInner>,
) {
  return usePublicView() ? null : <GenerateHighlightsButtonInner {...props} />
}
