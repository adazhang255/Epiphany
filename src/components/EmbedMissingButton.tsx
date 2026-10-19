"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useState } from "react"

// Older highlights predate embeddings; this computes them all in one go.
function EmbedMissingButtonInner({ count }: { count: number }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  if (count === 0) return null

  async function run() {
    setPending(true)
    setError("")
    const res = await fetch("/api/embeddings", { method: "POST" }).catch(
      () => null,
    )
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "Could not reach the server.")
    } else {
      router.refresh()
    }
    setPending(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-panel px-4 py-3 text-sm text-stone-400">
      <span>
        {count} {count === 1 ? "highlight hasn't" : "highlights haven't"} been
        read for meaning yet.
      </span>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-full border border-white/15 px-3 py-1 text-stone-200 transition hover:bg-white/5 disabled:opacity-60"
      >
        {pending ? "Reading…" : "Read them now"}
      </button>
      {error && (
        <span className="w-full text-xs text-rose-300/80">{error}</span>
      )}
    </div>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function EmbedMissingButton(
  props: React.ComponentProps<typeof EmbedMissingButtonInner>,
) {
  return usePublicView() ? null : <EmbedMissingButtonInner {...props} />
}
