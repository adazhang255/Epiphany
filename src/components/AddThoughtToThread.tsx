"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { holdThread } from "@/components/KeepThreadInPlace"
import type { ThreadRef } from "@/features/threads/membership"

// "+ Add a thought" at the end of a thread (the last item of its list, on a
// dot for what comes next): write a few words on the spot and they join the
// thread, as a new entry of their own (dated now).
function AddThoughtToThreadInner({ thread }: { thread: ThreadRef }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const anchor = useRef<HTMLLIElement>(null)

  function close() {
    setOpen(false)
    setText("")
    setError("")
  }

  async function add() {
    if (!text.trim() || saving) return
    setSaving(true)
    setError("")
    const res = await fetch("/api/threads/thought", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, thread }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setSaving(false)
    if (!res?.ok) return setError(data?.error ?? "Couldn't add it.")
    // keep the thread where it is on screen, even if the list reorders
    if (data?.thread) holdThread(data.thread, anchor.current)
    close()
    router.refresh()
  }

  const dot = (
    <span
      aria-hidden
      className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-dashed border-ember/50 bg-[#161617]"
    />
  )

  if (!open)
    return (
      <li ref={anchor} className="relative">
        {dot}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono text-[11px] uppercase tracking-widest text-stone-500 transition hover:text-stone-200"
        >
          + Add a thought
        </button>
      </li>
    )

  return (
    <li ref={anchor} className="relative space-y-2">
      {dot}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            add()
          }
          if (e.key === "Escape") close()
        }}
        autoFocus
        rows={3}
        placeholder="Where your thinking is now…"
        aria-label="A new thought for this thread"
        className="block w-full resize-y rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 font-serif text-lg leading-snug text-stone-100 outline-none placeholder:text-stone-600 focus:border-white/35"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={add}
          disabled={!text.trim() || saving}
          className="rounded-full bg-ink px-3 py-1 font-medium text-stone-900 transition hover:bg-white disabled:opacity-40"
        >
          {saving ? "Adding…" : "Add to thread"}
        </button>
        <button
          type="button"
          onClick={close}
          className="text-stone-500 hover:text-stone-300"
        >
          Cancel
        </button>
        <span className="text-stone-600">
          ⌘↵ to add · saved as a new entry, dated now
        </span>
        {error && <span className="text-rose-300">{error}</span>}
      </div>
    </li>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function AddThoughtToThread(
  props: React.ComponentProps<typeof AddThoughtToThreadInner>,
) {
  return usePublicView() ? null : <AddThoughtToThreadInner {...props} />
}
