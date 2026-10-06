"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { ThreadRef } from "@/features/threads/membership"

type ThreadOption = ThreadRef & { title: string; size: number }

// "Add to thread" on a highlight: pick which thread it belongs in. The list
// comes from the Threads page (threads you arranged, similar passages, and
// questions with answers, where it's added as an answer).
export function AddToThreadButton({
  item,
  exclude,
  quiet = false,
  className = "",
}: {
  item: string
  // the thread it's shown in (not offered)
  exclude?: string
  // show only on hover (inside a list of passages)
  quiet?: boolean
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState<ThreadOption[] | null>(null)
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

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (open) return setOpen(false)
    setOpen(true)
    setMessage("")
    if (!threads) {
      const data = await fetch("/api/threads")
        .then((r) => r.json())
        .catch(() => null)
      setThreads(data?.threads ?? [])
    }
  }

  async function add(thread: ThreadOption) {
    setMessage("Adding…")
    const res = await fetch("/api/threads/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, thread }),
    }).catch(() => null)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      return setMessage(data?.error ?? "Couldn't add it.")
    }
    setMessage(`Added to “${thread.title}”.`)
    setThreads(null) // the list changed
    router.refresh()
    window.setTimeout(() => setOpen(false), 1200)
  }

  const options = (threads ?? []).filter(
    (t) => t.id !== exclude && !t.memberIds.includes(item),
  )

  return (
    <span
      ref={anchor}
      className={`${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} ${className}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title="Add this highlight to a thread"
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest transition ${
          open
            ? "bg-ember/20 text-ember"
            : `text-stone-500 hover:bg-white/10 hover:text-ember ${quiet ? "opacity-0 focus:opacity-100 group-hover/member:opacity-100 group-hover/hl:opacity-100" : ""}`
        }`}
      >
        <span aria-hidden>⇢</span> Thread
      </button>
      {open && (
        <span
          role="dialog"
          aria-label="Add to which thread?"
          className="absolute right-0 top-full z-30 mt-1 block w-72 rounded-lg border border-white/15 bg-stone-900 p-2 font-sans text-xs normal-case tracking-normal shadow-xl shadow-black/50"
        >
          <span className="block px-1 pb-1.5 text-stone-400">
            Add to which thread?
          </span>
          {threads === null ? (
            <span className="block px-1 py-2 text-stone-500">Loading…</span>
          ) : options.length === 0 ? (
            <span className="block px-1 py-2 text-stone-500">
              No threads to add it to yet.
            </span>
          ) : (
            <span className="block max-h-64 overflow-y-auto">
              {options.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => add(t)}
                  className="flex w-full items-baseline gap-2 rounded px-1.5 py-1.5 text-left text-stone-200 hover:bg-white/10"
                >
                  <span className="min-w-0 flex-1 font-serif text-sm leading-snug">
                    {t.title}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-stone-500">
                    {t.kind === "qa" ? "as an answer" : `${t.size}`}
                  </span>
                </button>
              ))}
            </span>
          )}
          {message && (
            <span className="mt-1 block px-1 text-stone-400">{message}</span>
          )}
        </span>
      )}
    </span>
  )
}
