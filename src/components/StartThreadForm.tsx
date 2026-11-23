"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

// Start a new thread from highlights: name it, and they're its first
// passages. Then a link to it on the Threads page.
export function StartThreadForm({
  items,
  autoFocus = false,
  onStarted,
}: {
  items: string[] // highlights' ids, or "q-" + a question's
  autoFocus?: boolean
  onStarted?: (thread: string) => void
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [started, setStarted] = useState<string | null>(null)

  // Closed (clicked away) with a name typed but not started: start it
  // anyway, so what you typed isn't lost
  const pending = useRef({ name: "", items, done: false })
  useEffect(() => {
    pending.current = { name, items, done: Boolean(started) || busy }
  })
  useEffect(
    () => () => {
      const { name, items, done } = pending.current
      if (done || !name.trim()) return
      fetch("/api/threads/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, name }),
        keepalive: true,
      })
        .then((res) => res.ok && router.refresh())
        .catch(() => null)
    },
    // only when it goes away
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  async function start() {
    if (!name.trim() || busy) return
    setBusy(true)
    setError("")
    const res = await fetch("/api/threads/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, name }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) return setError(data?.error ?? "Couldn't start it.")
    setStarted(data.thread)
    router.refresh()
    onStarted?.(data.thread)
  }

  if (started)
    return (
      <span className="block px-1 py-1 text-stone-300">
        Started “{name.trim()}”.{" "}
        <Link
          href={`/threads#thread-${started}`}
          className="text-ember underline hover:text-ink"
        >
          Open it
        </Link>
      </span>
    )

  return (
    <span className="block">
      <span className="flex items-center gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              start()
            }
          }}
          autoFocus={autoFocus}
          maxLength={80}
          placeholder="Name a new thread…"
          aria-label="New thread's name"
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-transparent px-2 py-1 text-xs text-stone-100 outline-none focus:border-white/40"
        />
        <button
          type="button"
          onClick={start}
          disabled={!name.trim() || busy}
          className="shrink-0 rounded-md bg-ember/90 px-2 py-1 text-xs font-medium text-stone-950 disabled:opacity-40"
        >
          {busy ? "…" : "Start"}
        </button>
      </span>
      {error && <span className="mt-1 block px-1 text-rose-300">{error}</span>}
    </span>
  )
}
