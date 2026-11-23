"use client"

import { JumpIcon } from "@/components/icons"
import { useThreadTitle } from "@/components/threadTitles"
import { useEffect, useRef, useState } from "react"

export type TopicItem = {
  id: string
  title: string | null // known when the page was built
  fallback: string // its opening words
  count: number
}

function Topic({ topic, onPick }: { topic: TopicItem; onPick: () => void }) {
  // a title the model writes after the page opened shows here too
  const shared = useThreadTitle(topic.id)
  const title = topic.title ?? shared
  return (
    <li className="shrink-0">
      <a
        href={`#thread-${topic.id}`}
        onClick={onPick}
        className="flex max-w-[16rem] items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-sm transition hover:border-white/25"
      >
        {/* the same two looks as the thread itself: titled, or untitled */}
        <span
          className={`truncate ${title ? "text-stone-100" : "text-stone-400"}`}
        >
          {title ?? topic.fallback}
        </span>
        <span className="font-mono text-[10px] text-stone-500">
          {topic.count}
        </span>
      </a>
    </li>
  )
}

// "Threads ▾" in the filter row: every thread shown, by name, in a box that
// opens under the row. Click one to jump to it.
export function ThreadTopics({ topics }: { topics: TopicItem[] }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (topics.length === 0) return null
  return (
    // (the box is placed against the filter row, which is `relative`)
    <span ref={anchor} className="ml-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Jump to a thread"
        // not a filter: a square-cornered, filled button at the far end of
        // the row, so it doesn't read as one more filter chip
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm transition ${
          open
            ? "border-white/30 bg-white/15 text-ink"
            : "border-white/15 bg-white/[0.07] text-stone-200 hover:border-white/30 hover:text-ink"
        }`}
      >
        <JumpIcon />
        Go to a thread
        <span className="font-mono text-xs text-stone-500">
          {topics.length}
        </span>
        <span aria-hidden className="text-xs text-stone-400">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <ul
          aria-label="Threads"
          className="absolute left-0 right-0 top-full z-30 mt-2 flex max-h-[50vh] flex-wrap gap-2 overflow-y-auto rounded-xl border border-white/15 bg-stone-900 p-3 shadow-xl shadow-black/50"
        >
          {topics.map((t) => (
            <Topic key={t.id} topic={t} onPick={() => setOpen(false)} />
          ))}
        </ul>
      )}
    </span>
  )
}
