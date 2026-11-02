"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { ThreadRef } from "@/features/threads/membership"

// "Remove thread" on a thread: take it apart, after asking if you're sure.
// Its highlights and entries stay as they are. `onHide` hides the thread at
// once (the page takes a moment to rebuild), and shows it again, with why,
// if removing it failed.
function RemoveThreadButtonInner({
  thread,
  onHide,
}: {
  thread: ThreadRef
  onHide?: (hidden: boolean, error?: string) => void
}) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const anchor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!asking) return
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setAsking(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [asking])

  async function remove() {
    setBusy(true)
    setError(null)
    onHide?.(true)
    const res = await fetch("/api/threads/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      const why = await res
        ?.json()
        .then((d) => d?.error)
        .catch(() => null)
      const message =
        why ?? (res ? "Couldn’t remove it." : "Couldn’t reach the app.")
      setError(message)
      onHide?.(false, message)
      return
    }
    setAsking(false)
    router.refresh()
  }

  return (
    <span ref={anchor} className="relative">
      <button
        type="button"
        onClick={() => setAsking((a) => !a)}
        aria-expanded={asking}
        title="Take this thread apart (your highlights and entries stay)"
        className={`rounded-full border px-3 py-1 text-xs transition ${
          asking
            ? "border-rose-400/40 bg-rose-400/10 text-rose-200"
            : "border-white/10 text-stone-500 hover:border-rose-400/40 hover:text-rose-300"
        }`}
      >
        Remove thread
      </button>
      {asking && (
        <span
          role="alertdialog"
          aria-label="Remove this thread?"
          className="absolute left-0 top-full z-20 mt-1 flex w-max max-w-[85vw] flex-wrap items-center gap-2 rounded-md border border-rose-400/40 bg-stone-900 px-2 py-1.5 text-xs shadow-xl shadow-black/50"
        >
          <span className="text-rose-200">
            {error ??
              (thread.kind === "qa"
                ? "Unlink every answer from this question? Your highlights stay."
                : "Take this thread apart? Your highlights and entries stay, just not threaded.")}
          </span>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="rounded px-2 py-0.5 text-stone-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded bg-rose-400 px-2 py-0.5 font-bold text-stone-950 disabled:opacity-50"
          >
            {busy ? "Removing…" : "Yes, remove"}
          </button>
        </span>
      )}
    </span>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function RemoveThreadButton(
  props: React.ComponentProps<typeof RemoveThreadButtonInner>,
) {
  return usePublicView() ? null : <RemoveThreadButtonInner {...props} />
}
