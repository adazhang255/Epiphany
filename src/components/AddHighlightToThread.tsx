"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { HighlightKind } from "@/components/HighlightKind"
import { holdThread } from "@/components/KeepThreadInPlace"
import type { ThreadRef } from "@/features/threads/membership"
import { EntryTitle } from "@/components/EntryTitle"

type Found = {
  id: string
  quote: string
  category: string
  noteTitle: string
  date: string
}

// "+ Add a highlight" on a thread: search your highlights by their words and
// pick one to add to this thread.
function AddHighlightToThreadInner({ thread }: { thread: ThreadRef }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [found, setFound] = useState<Found[]>([])
  const [message, setMessage] = useState("")
  const anchor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // search as you type (a moment after you stop)
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(async () => {
      const data = await fetch(
        `/api/highlights/find?q=${encodeURIComponent(q)}`,
      )
        .then((r) => r.json())
        .catch(() => null)
      setFound(
        (data?.highlights ?? []).filter(
          (h: Found) => !thread.memberIds.includes(h.id),
        ),
      )
    }, 250)
    return () => window.clearTimeout(timer)
  }, [q, open, thread.memberIds])

  async function add(h: Found) {
    setMessage("Adding…")
    const res = await fetch("/api/threads/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: h.id, thread }),
    }).catch(() => null)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      return setMessage(data?.error ?? "Couldn't add it.")
    }
    const data = await res.json().catch(() => null)
    // keep the thread where it is on screen, even if the list reorders
    if (data?.thread) holdThread(data.thread, anchor.current)
    setMessage("")
    setOpen(false)
    setQ("")
    router.refresh()
  }

  return (
    <span ref={anchor} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-400 transition hover:border-white/25 hover:text-stone-200"
      >
        + Add a highlight
      </button>
      {open && (
        <span
          role="dialog"
          aria-label="Add a highlight to this thread"
          className="absolute left-0 top-full z-30 mt-1 block w-96 max-w-[85vw] rounded-lg border border-white/15 bg-stone-900 p-2 text-xs shadow-xl shadow-black/50"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder={
              thread.kind === "qa"
                ? "Find the highlight that answers it…"
                : "Find a highlight by its words…"
            }
            aria-label="Find a highlight"
            className="w-full rounded-md border border-white/15 bg-transparent px-2 py-1.5 text-sm text-stone-100 outline-none focus:border-white/40"
          />
          <span className="mt-2 block max-h-72 overflow-y-auto">
            {found.length === 0 ? (
              <span className="block px-1 py-2 text-stone-500">
                No highlights match.
              </span>
            ) : (
              found.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => add(h)}
                  className="block w-full rounded px-1.5 py-1.5 text-left hover:bg-white/10"
                >
                  <span className="flex items-center gap-2 text-stone-500">
                    <HighlightKind category={h.category} />
                    <span className="truncate">
                      <EntryTitle title={h.noteTitle} />
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block font-serif text-sm leading-snug text-stone-200">
                    “{h.quote}”
                  </span>
                </button>
              ))
            )}
          </span>
          {message && (
            <span className="mt-1 block px-1 text-stone-400">{message}</span>
          )}
        </span>
      )}
    </span>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function AddHighlightToThread(
  props: React.ComponentProps<typeof AddHighlightToThreadInner>,
) {
  return usePublicView() ? null : <AddHighlightToThreadInner {...props} />
}
