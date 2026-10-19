"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { titleText } from "@/features/notes/lib/titles"

// Delete an entry: one click asks, a second confirms. The server keeps a
// backup in backups/ before removing it.
function DeleteEntryButtonInner({
  noteId,
  title,
  onDeleted,
  redirectTo,
  className = "",
  idleClassName = "",
  variant = "quiet",
}: {
  noteId: string
  title: string
  // e.g. drop it from a list already on screen
  onDeleted?: () => void
  // where to go afterwards (the entry's own page no longer exists)
  redirectTo?: string
  className?: string
  // extra classes for the resting button only (e.g. show on hover)
  idleClassName?: string
  // "outlined": a clearly visible red button (e.g. on notebook pages)
  variant?: "quiet" | "outlined"
}) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const anchor = useRef<HTMLSpanElement>(null)

  // clicking anywhere else closes the confirm
  useEffect(() => {
    if (!asking) return
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setAsking(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [asking])

  async function remove() {
    setDeleting(true)
    setError("")
    const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" }).catch(
      () => null,
    )
    setDeleting(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "Couldn't delete")
      return
    }
    onDeleted?.()
    if (redirectTo) router.push(redirectTo)
    else router.refresh()
  }

  // The confirm opens as a one-line box anchored just above the button, so
  // nothing around it moves or wraps.
  return (
    <span ref={anchor} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-expanded={asking}
        onClick={() => setAsking((a) => !a)}
        className={`font-mono uppercase tracking-widest transition ${
          variant === "outlined"
            ? `rounded-md border border-rose-400/40 px-2.5 py-1 text-xs text-rose-200 hover:border-rose-400/70 hover:bg-rose-400/15 ${asking ? "bg-rose-400/20" : "bg-rose-400/[0.06]"}`
            : `rounded-md px-2 py-0.5 text-[11px] hover:bg-rose-400/10 hover:text-rose-300 ${asking ? "bg-rose-400/10 text-rose-300" : "text-stone-500"}`
        } ${asking ? "" : idleClassName}`}
      >
        {variant === "outlined" && (
          <span aria-hidden className="mr-1">
            ✕
          </span>
        )}
        Delete
      </button>

      {asking && (
        <span
          role="alertdialog"
          aria-label={`Delete “${titleText(title)}”?`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault() // closes this, not the editor around it
              setAsking(false)
            }
          }}
          className="absolute bottom-full right-0 z-30 mb-2 flex items-center gap-2 whitespace-nowrap rounded-md border border-rose-400/40 bg-stone-900 px-2 py-1 font-mono text-[11px] shadow-xl shadow-black/50"
        >
          <span className="text-rose-200">
            {error || "Delete this entry and its highlights?"}
          </span>
          <button
            type="button"
            onClick={() => setAsking(false)}
            autoFocus
            className="rounded px-2 py-0.5 text-stone-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="rounded bg-rose-400 px-2 py-0.5 font-bold text-stone-950 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </span>
      )}
    </span>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function DeleteEntryButton(
  props: React.ComponentProps<typeof DeleteEntryButtonInner>,
) {
  return usePublicView() ? null : <DeleteEntryButtonInner {...props} />
}
