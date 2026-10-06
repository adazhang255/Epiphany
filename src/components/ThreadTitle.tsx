"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { ThreadRef } from "@/features/threads/membership"

// A thread's title: the name you gave it, or one the local model writes
// (shown as a placeholder until it's ready). ✎ renames it.
export function ThreadTitle({
  quoteIds,
  known,
  fallback,
  thread,
  named = false,
}: {
  quoteIds: string[]
  known: string | null
  fallback: string
  // set when it can be renamed (not a question's thread)
  thread?: ThreadRef
  named?: boolean
}) {
  const router = useRouter()
  const [title, setTitle] = useState(known)
  const [failed, setFailed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ids = quoteIds.join(",")

  useEffect(() => {
    if (known || quoteIds.length < 2) return
    let alive = true
    fetch(`/api/threads/title?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d?.title) setTitle(d.title)
        else setFailed(true)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [ids, known, quoteIds.length])

  async function save(name: string) {
    if (!thread) return
    setSaving(true)
    setError(null)
    const res = await fetch("/api/threads/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread, name }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      // say why, rather than leaving the form looking like nothing happened
      const why = await res
        ?.json()
        .then((d) => d?.error)
        .catch(() => null)
      setError(
        why ??
          (res
            ? "Couldn’t save the name. Try again, or restart the app."
            : "Couldn’t reach the app to save the name."),
      )
      return
    }
    if (name.trim()) setTitle(name.trim())
    setEditing(false)
    router.refresh()
  }

  if (editing && thread) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save(draft)
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          autoFocus
          maxLength={80}
          aria-label="Thread name"
          placeholder="Name this thread"
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-transparent px-2 py-1 font-serif text-2xl leading-tight text-ink outline-none focus:border-white/40"
        />
        <button
          type="submit"
          disabled={saving || !draft.trim()}
          className="rounded-full bg-ember px-3 py-1 text-xs font-medium text-stone-950 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {named && (
          <button
            type="button"
            onClick={() => save("")}
            disabled={saving}
            className="text-xs text-stone-400 underline hover:text-stone-200"
          >
            Use automatic title
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setError(null)
          }}
          className="text-xs text-stone-500 hover:text-stone-300"
        >
          Cancel
        </button>
        {error && (
          <p role="alert" className="w-full text-xs text-rose-300">
            {error}
          </p>
        )}
      </form>
    )
  }

  return (
    <h2 className="group/title flex items-baseline gap-2 font-serif text-2xl leading-tight text-ink">
      <span>
        {title ?? (
          <span className={failed ? "" : "animate-pulse text-stone-400"}>
            {fallback}
          </span>
        )}
      </span>
      {thread && (
        <button
          type="button"
          onClick={() => {
            setDraft(title ?? "")
            setEditing(true)
          }}
          aria-label="Rename this thread"
          title="Rename this thread"
          className="font-sans text-sm text-stone-400 opacity-0 transition hover:text-ember focus:opacity-100 group-hover/title:opacity-100"
        >
          ✎
        </button>
      )}
    </h2>
  )
}
