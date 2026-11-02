"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useState } from "react"

// "+ New thread" at the top of the Threads page: a name and a first thought,
// written on the spot. The thought becomes a new entry (dated now); the
// thread then takes more thoughts or highlights like any other.
function NewThreadInner() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function close() {
    setOpen(false)
    setName("")
    setText("")
    setError("")
  }

  async function create() {
    if (!name.trim() || !text.trim() || saving) return
    setSaving(true)
    setError("")
    const res = await fetch("/api/threads/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, text }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setSaving(false)
    if (!res?.ok) return setError(data?.error ?? "Couldn't start it.")
    close()
    router.refresh()
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-ember/50 bg-ember/10 px-4 py-1.5 text-sm text-ember transition hover:border-ember hover:bg-ember/20"
      >
        + New thread
      </button>
    )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        create()
      }}
      onKeyDown={(e) => e.key === "Escape" && close()}
      className="w-full space-y-2 rounded-2xl border border-ember/30 bg-panel p-5"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        maxLength={80}
        placeholder="What's the thread about?"
        aria-label="Thread name"
        className="block w-full bg-transparent font-serif text-2xl text-ink outline-none placeholder:text-stone-600"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            create()
          }
        }}
        rows={3}
        placeholder="Its first thought…"
        aria-label="The thread's first thought"
        className="block w-full resize-y rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 font-serif text-lg leading-snug text-stone-100 outline-none placeholder:text-stone-600 focus:border-white/35"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          type="submit"
          disabled={!name.trim() || !text.trim() || saving}
          className="rounded-full bg-ink px-3 py-1 font-medium text-stone-900 transition hover:bg-white disabled:opacity-40"
        >
          {saving ? "Starting…" : "Start thread"}
        </button>
        <button
          type="button"
          onClick={close}
          className="text-stone-500 hover:text-stone-300"
        >
          Cancel
        </button>
        <span className="text-stone-600">
          ⌘↵ to start · the thought is saved as a new entry, dated now
        </span>
        {error && <span className="text-rose-300">{error}</span>}
      </div>
    </form>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function NewThread() {
  return usePublicView() ? null : <NewThreadInner />
}
