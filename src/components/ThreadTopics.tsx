"use client"

import { useEffect, useRef, useState } from "react"
import { useThreadTitle } from "@/components/threadTitles"

export type TopicItem = {
  id: string
  title: string | null // known when the page was built
  fallback: string // its opening words
  count: number
}

function Topic({
  topic,
  current,
  onPick,
}: {
  topic: TopicItem
  current: boolean
  onPick: () => void
}) {
  // a title the model writes after the page opened shows here too
  const shared = useThreadTitle(topic.id)
  const title = topic.title ?? shared
  return (
    <li className="shrink-0">
      <a
        href={`#thread-${topic.id}`}
        onClick={onPick}
        aria-current={current ? "true" : undefined}
        data-topic={topic.id}
        className={`flex max-w-[16rem] items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${
          current
            ? "border-ember/70 bg-ember/10 text-ink"
            : "border-white/10 hover:border-ember/50 hover:text-ink"
        }`}
      >
        <span
          className={`truncate ${current || title ? "text-stone-100" : "text-stone-500"}`}
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

// Every thread's topic, in a bar that stays at the top of the page as you
// read: one row you can scroll sideways, the thread you're reading lit up
// (and kept in view); "All" opens the whole list, in a box of its own.
// Click one to jump to it.
export function ThreadTopics({ topics }: { topics: TopicItem[] }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const row = useRef<HTMLUListElement>(null)
  const ids = topics.map((t) => t.id).join(",")

  // the thread you're reading: the topmost one on screen, below the bar
  useEffect(() => {
    const seen = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          seen.set((e.target as HTMLElement).dataset.thread!, e.isIntersecting)
        const first = [
          ...document.querySelectorAll<HTMLElement>("[data-thread]"),
        ]
          .map((el) => el.dataset.thread!)
          .find((id) => seen.get(id))
        if (first) setCurrent(first)
      },
      { rootMargin: "-140px 0px -45% 0px" },
    )
    document
      .querySelectorAll("[data-thread]")
      .forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])

  // keep it in view in the row
  useEffect(() => {
    const chip = row.current?.querySelector<HTMLElement>(
      `[data-topic="${current}"]`,
    )
    const box = row.current
    if (!chip || !box || open) return
    const left = chip.offsetLeft - box.clientWidth / 2 + chip.clientWidth / 2
    box.scrollTo({ left, behavior: "smooth" })
  }, [current, open])

  if (topics.length === 0) return null
  return (
    <nav
      aria-label="Thread topics"
      className="sticky top-14 z-20 -mx-4 mb-8 border-b border-white/5 bg-paper/90 px-4 py-2.5 backdrop-blur-xl sm:top-16 sm:-mx-6 sm:px-6 lg:top-0"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="shrink-0 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-stone-200 transition hover:bg-white/15"
        >
          {open ? "Close ▴" : `All ${topics.length} ▾`}
        </button>
        <ul
          ref={row}
          className={
            open
              ? "hidden"
              : "flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          }
        >
          {topics.map((t) => (
            <Topic
              key={t.id}
              topic={t}
              current={t.id === current}
              onPick={() => setCurrent(t.id)}
            />
          ))}
        </ul>
        {open && (
          <span className="font-mono text-[11px] uppercase tracking-widest text-stone-500">
            {topics.length} {topics.length === 1 ? "thread" : "threads"}
          </span>
        )}
      </div>
      {open && (
        <ul className="mt-3 flex max-h-[50vh] flex-wrap gap-2 overflow-y-auto pb-1">
          {topics.map((t) => (
            <Topic
              key={t.id}
              topic={t}
              current={t.id === current}
              onPick={() => {
                setCurrent(t.id)
                setOpen(false)
              }}
            />
          ))}
        </ul>
      )}
    </nav>
  )
}
