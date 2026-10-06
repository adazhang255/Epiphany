"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { ThreadRef } from "@/features/threads/membership"

// "×" on a passage in a thread: take it out, after asking if you're sure.
// For a question's thread the answer is unlinked from the question; for
// other threads the passage is left out of threads. Nothing in your entries
// changes either way.
export function RemoveFromThreadButton({
  item,
  thread,
}: {
  item: string
  thread: ThreadRef
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
    const res = await fetch("/api/threads/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, thread }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      // keep the question open and say why, rather than look like it worked
      const why = await res
        ?.json()
        .then((d) => d?.error)
        .catch(() => null)
      setError(
        why ??
          (res
            ? "Couldn’t remove it. Try again, or restart the app."
            : "Couldn’t reach the app."),
      )
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
        aria-label="Remove from this thread"
        title="Remove from this thread (your entry stays as it is)"
        className={`flex h-6 w-6 items-center justify-center rounded-full text-base leading-none transition ${
          asking
            ? "bg-rose-400/20 text-rose-200"
            : "text-stone-500 opacity-0 hover:bg-white/10 hover:text-rose-300 focus:opacity-100 group-hover/member:opacity-100"
        }`}
      >
        ×
      </button>
      {asking && (
        <span
          role="alertdialog"
          aria-label="Remove from this thread?"
          className="absolute right-0 top-full z-20 mt-1 flex items-center gap-2 whitespace-nowrap rounded-md border border-rose-400/40 bg-stone-900 px-2 py-1 font-mono text-[11px] normal-case tracking-normal shadow-xl shadow-black/50"
        >
          <span className="text-rose-200">
            {error ??
              (thread.kind === "qa"
                ? "Are you sure this isn't an answer to the question?"
                : "Are you sure you want to remove this from the thread?")}
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
