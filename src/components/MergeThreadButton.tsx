"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { holdThread } from "@/components/KeepThreadInPlace"
import { showUndo } from "@/components/UndoToast"
import { useThreadTitle } from "@/components/threadTitles"
import type { ThreadRef } from "@/features/threads/membership"

export type MergeOption = {
  thread: ThreadRef
  title: string | null
  fallback: string // its opening words
}

function Option({
  option,
  onPick,
}: {
  option: MergeOption
  onPick: (title: string) => void
}) {
  const shared = useThreadTitle(option.thread.id)
  const title = option.title ?? shared ?? option.fallback
  return (
    <button
      type="button"
      onClick={() => onPick(title)}
      className="flex w-full items-baseline gap-2 rounded px-1.5 py-1.5 text-left text-stone-200 hover:bg-white/10"
    >
      <span className="min-w-0 flex-1 font-serif text-sm leading-snug">
        {title}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-stone-500">
        {option.thread.memberIds.length}
      </span>
    </button>
  )
}

// "Merge…" on a thread: pick another to merge it into (both become one
// thread of yours, with every passage of both). Undoable.
function MergeThreadButtonInner({
  thread,
  others,
}: {
  thread: ThreadRef
  others: MergeOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [error, setError] = useState("")
  const anchor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  async function merge(into: ThreadRef, title: string) {
    setError("")
    const res = await fetch("/api/threads/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: thread, into }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) return setError(data?.error ?? "Couldn't merge them.")
    // keep the merged thread where this one was on screen
    if (data?.thread) holdThread(data.thread, anchor.current)
    showUndo({ label: `Merged into “${title}”`, token: data?.undo })
    setOpen(false)
    router.refresh()
  }

  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = others.filter((o) =>
    words.every((w) =>
      `${o.title ?? ""} ${o.fallback}`.toLowerCase().includes(w),
    ),
  )

  if (others.length === 0) return null
  return (
    <span ref={anchor} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Merge this thread into another"
        className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-400 transition hover:border-white/25 hover:text-stone-200"
      >
        Merge…
      </button>
      {open && (
        <span
          role="dialog"
          aria-label="Merge into which thread?"
          className="absolute left-0 top-full z-30 mt-1 block w-80 max-w-[85vw] rounded-lg border border-white/15 bg-stone-900 p-2 text-xs shadow-xl shadow-black/50"
        >
          <span className="block px-1 pb-1.5 text-stone-400">
            Merge this thread into…
          </span>
          {others.length > 6 && (
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder="Find a thread…"
              aria-label="Find a thread"
              className="mb-1.5 w-full rounded-md border border-white/15 bg-transparent px-2 py-1 text-sm text-stone-100 outline-none focus:border-white/40"
            />
          )}
          <span className="block max-h-64 overflow-y-auto">
            {shown.length === 0 ? (
              <span className="block px-1 py-2 text-stone-500">
                No thread matches.
              </span>
            ) : (
              shown.map((o) => (
                <Option
                  key={o.thread.id}
                  option={o}
                  onPick={(title) => merge(o.thread, title)}
                />
              ))
            )}
          </span>
          {error && (
            <span className="mt-1 block px-1 text-rose-300">{error}</span>
          )}
        </span>
      )}
    </span>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function MergeThreadButton(
  props: React.ComponentProps<typeof MergeThreadButtonInner>,
) {
  return usePublicView() ? null : <MergeThreadButtonInner {...props} />
}
