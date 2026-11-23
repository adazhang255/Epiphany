"use client"

import { MergeIcon } from "@/components/icons"
import { PILL, PILL_ON } from "@/components/buttonStyles"
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
  // its passages, to look over before merging
  passages: { id: string; quote: string; date: Date }[]
}

// a thread's title as shown: its own, the model's, or its opening words
function useShownTitle(
  option: Pick<MergeOption, "thread" | "title" | "fallback">,
) {
  const shared = useThreadTitle(option.thread.id)
  return option.title ?? shared ?? option.fallback
}

function Option({
  option,
  onPick,
}: {
  option: MergeOption
  onPick: () => void
}) {
  const title = useShownTitle(option)
  const untitled = title === option.fallback
  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex w-full items-baseline gap-2 rounded px-1.5 py-1.5 text-left hover:bg-white/10 ${
        untitled ? "text-stone-400" : "text-stone-200"
      }`}
    >
      <span className="min-w-0 flex-1 font-serif text-sm leading-snug">
        {title}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-stone-500">
        {option.thread.memberIds.length} ›
      </span>
    </button>
  )
}

const shortDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

// The thread picked to merge with: its passages, and what the merged
// thread will be called (this one's name, the other's, or a new one).
function Preview({
  own,
  option,
  busy,
  onBack,
  onMerge,
}: {
  own: Pick<MergeOption, "thread" | "title" | "fallback">
  option: MergeOption
  busy: boolean
  onBack: () => void
  onMerge: (name: string) => void
}) {
  const ownTitle = useShownTitle(own)
  const theirTitle = useShownTitle(option)
  const [choice, setChoice] = useState<"theirs" | "ours" | "new">("theirs")
  const [typed, setTyped] = useState("")
  const name =
    choice === "theirs" ? theirTitle : choice === "ours" ? ownTitle : typed
  const total = new Set([...own.thread.memberIds, ...option.thread.memberIds])
    .size

  const radio = (value: typeof choice, label: React.ReactNode) => (
    <label className="flex cursor-pointer items-baseline gap-2 rounded px-1.5 py-1 hover:bg-white/5">
      <input
        type="radio"
        name="merged-name"
        checked={choice === value}
        onChange={() => setChoice(value)}
        className="accent-ember"
      />
      <span className="min-w-0 flex-1">{label}</span>
    </label>
  )

  return (
    <span className="block">
      <button
        type="button"
        onClick={onBack}
        className="px-1 pb-1.5 text-stone-500 hover:text-stone-300"
      >
        ‹ Other threads
      </button>
      <span className="block px-1 font-serif text-base leading-snug text-ink">
        {theirTitle}
      </span>
      <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto border-l border-ember/30 pl-3">
        {option.passages.map((p) => (
          <li key={p.id}>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-stone-500">
              {shortDate(p.date)}
            </span>
            <span className="block font-serif text-[13px] leading-snug text-stone-300">
              “{p.quote.length > 160 ? `${p.quote.slice(0, 160)}…` : p.quote}”
            </span>
          </li>
        ))}
      </ol>

      <span className="mt-3 block border-t border-white/10 pt-2">
        <span className="block px-1 pb-1 text-stone-400">
          Call the merged thread ({total} passages):
        </span>
        {radio(
          "theirs",
          <span className="font-serif text-sm text-stone-200">
            {theirTitle}
          </span>,
        )}
        {ownTitle !== theirTitle &&
          radio(
            "ours",
            <span className="font-serif text-sm text-stone-200">
              {ownTitle}
            </span>,
          )}
        {radio(
          "new",
          <input
            value={typed}
            onFocus={() => setChoice("new")}
            onChange={(e) => {
              setTyped(e.target.value)
              setChoice("new")
            }}
            maxLength={80}
            placeholder="A new name…"
            aria-label="A new name for the merged thread"
            className="w-full rounded-md border border-white/15 bg-transparent px-2 py-0.5 text-sm text-stone-100 outline-none focus:border-white/40"
          />,
        )}
      </span>
      <span className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md px-2 py-1 text-stone-400 hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => onMerge(name.trim())}
          className="rounded-md bg-ember/90 px-3 py-1 font-medium text-stone-950 disabled:opacity-40"
        >
          {busy ? "Merging…" : "Merge"}
        </button>
      </span>
    </span>
  )
}

// "Merge…" on a thread: pick another, look it over, choose the merged
// thread's name, and merge (both become one thread of yours, with every
// passage of both). Undoable.
function MergeThreadButtonInner({
  thread,
  title,
  fallback,
  others,
}: {
  thread: ThreadRef
  // this thread's title (null until it has one) and opening words
  title: string | null
  fallback: string
  others: MergeOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [error, setError] = useState("")
  const [picked, setPicked] = useState<MergeOption | null>(null)
  const [busy, setBusy] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  async function merge(into: ThreadRef, name: string) {
    setError("")
    setBusy(true)
    const res = await fetch("/api/threads/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: thread, into, name }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) return setError(data?.error ?? "Couldn't merge them.")
    // keep the merged thread where this one was on screen
    if (data?.thread) holdThread(data.thread, anchor.current)
    showUndo({ label: `Merged into “${name}”`, token: data?.undo })
    setOpen(false)
    setPicked(null)
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
        onClick={() => {
          setOpen((o) => !o)
          setPicked(null)
        }}
        aria-expanded={open}
        title="Merge this thread with another"
        className={open ? PILL_ON : PILL}
      >
        <MergeIcon /> Merge…
      </button>
      {open && (
        <span
          role="dialog"
          aria-label="Merge with which thread?"
          className="absolute left-0 top-full z-30 mt-1 block w-96 max-w-[88vw] rounded-lg border border-white/15 bg-stone-900 p-2 text-xs shadow-xl shadow-black/50"
        >
          {picked ? (
            <Preview
              own={{ thread, title, fallback }}
              option={picked}
              busy={busy}
              onBack={() => setPicked(null)}
              onMerge={(name) => merge(picked.thread, name)}
            />
          ) : (
            <>
              <span className="block px-1 pb-1.5 text-stone-400">
                Merge this thread with… (pick one to look it over)
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
                      onPick={() => setPicked(o)}
                    />
                  ))
                )}
              </span>
            </>
          )}
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
