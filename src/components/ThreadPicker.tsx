"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import type { ThreadRef } from "@/features/threads/membership"
import { StartThreadForm } from "@/components/StartThreadForm"

type ThreadOption = ThreadRef & { title: string; size: number }

// Put highlights (one or several) in a thread: pick one of your threads
// (threads you arranged, similar passages, and questions with answers,
// where they're added as answers), or start a new one with them. Used in a
// highlight's menu on its entry, and for the highlights you selected on the
// Highlights page.
export function ThreadPicker({
  items,
  onDone,
}: {
  items: string[] // highlights' ids, or "q-" + a question's
  // once they're in a thread (its id)
  onDone?: (thread: string) => void
}) {
  const router = useRouter()
  const [threads, setThreads] = useState<ThreadOption[] | null>(null)
  const [message, setMessage] = useState("")
  const [added, setAdded] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/threads")
      .then((r) => r.json())
      .catch(() => null)
      .then((data) => alive && setThreads(data?.threads ?? []))
    return () => {
      alive = false
    }
  }, [])

  async function add(thread: ThreadOption) {
    setMessage("Adding…")
    const res = await fetch("/api/threads/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, thread }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) return setMessage(data?.error ?? "Couldn't add them.")
    setMessage(`Added to “${thread.title}”.`)
    setAdded(data.thread)
    router.refresh()
    onDone?.(data.thread)
  }

  // threads they aren't all in already
  const options = (threads ?? []).filter(
    (t) => !items.every((id) => t.memberIds.includes(id)),
  )
  const some = items.length > 1 ? "them" : "it"

  return (
    <div className="font-sans text-xs normal-case tracking-normal">
      <p className="px-1 pb-1.5 text-stone-400">
        Add {items.length > 1 ? `${items.length} highlights` : "it"} to which
        thread?
      </p>
      {threads === null ? (
        <p className="px-1 py-2 text-stone-500">Loading…</p>
      ) : options.length === 0 ? (
        <p className="px-1 py-2 text-stone-500">
          No threads to add {some} to yet.
        </p>
      ) : (
        <div className="max-h-56 overflow-y-auto">
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
        </div>
      )}
      {message && (
        <p className="mt-1 px-1 text-stone-400">
          {message}{" "}
          {added && (
            <Link
              href={`/threads#thread-${added}`}
              className="text-ember underline hover:text-ink"
            >
              Open it
            </Link>
          )}
        </p>
      )}
      <div className="mt-2 border-t border-white/10 pt-2">
        <p className="px-1 pb-1.5 text-stone-400">
          …or start a new one with {some}:
        </p>
        <StartThreadForm items={items} onStarted={onDone} />
      </div>
    </div>
  )
}
