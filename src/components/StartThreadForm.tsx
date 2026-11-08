"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

// Start a new thread from one highlight: name it, and the highlight is its
// first passage. Then a link to it on the Threads page.
export function StartThreadForm({
  item,
  autoFocus = false,
}: {
  item: string // a highlight's id, or "q-" + a question's
  autoFocus?: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [started, setStarted] = useState<string | null>(null)

  async function start() {
    if (!name.trim() || busy) return
    setBusy(true)
    setError("")
    const res = await fetch("/api/threads/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, name }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) return setError(data?.error ?? "Couldn't start it.")
    setStarted(data.thread)
    router.refresh()
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
