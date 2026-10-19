"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useState } from "react"

// Scores the tone of entries that don't have one yet, with the local model.
// (Entries get no category of their own; it comes from their highlights.)
function ClassifyButtonInner({ missing }: { missing: number }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")

  if (missing === 0 && !message) return null

  async function run() {
    setPending(true)
    setMessage("")
    const res = await fetch("/api/notes/classify", { method: "POST" }).catch(
      () => null,
    )
    const body = await res?.json().catch(() => null)
    setPending(false)
    if (!res?.ok) {
      setMessage(body?.error ?? "Could not reach the server.")
      return
    }
    setMessage(
      `Updated ${body.classified} ${body.classified === 1 ? "entry" : "entries"}.`,
    )
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-stone-400">
      {missing > 0 && (
        <>
          <span>
            {missing} {missing === 1 ? "entry is" : "entries are"} missing a
            tone score.
          </span>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="rounded-full border border-white/15 px-3 py-1 text-stone-200 transition hover:bg-white/5 disabled:opacity-60"
          >
            {pending ? "Scoring tone…" : "Score them"}
          </button>
        </>
      )}
      {message && <span className="text-xs text-stone-400">{message}</span>}
    </div>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function ClassifyButton(
  props: React.ComponentProps<typeof ClassifyButtonInner>,
) {
  return usePublicView() ? null : <ClassifyButtonInner {...props} />
}
