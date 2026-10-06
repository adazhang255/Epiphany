"use client"

import { useState } from "react"

// A notebook page's title. ✎ (on hover) renames it right there, like a
// thread's title: Enter or Save keeps it, Esc or Cancel leaves it as it was.
// Stays on its one ruled line.
export function NotebookTitle({
  noteId,
  title: initial,
}: {
  noteId: string
  title: string
}) {
  const [title, setTitle] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function start() {
    setDraft(title)
    setError("")
    setEditing(true)
  }

  async function save() {
    const next = draft.trim()
    if (next === title) return setEditing(false)
    setSaving(true)
    setError("")
    const res = await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      return setError(data?.error ?? "Couldn’t save the title.")
    }
    setTitle(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="flex h-[30px] min-w-0 flex-1 items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          autoFocus
          maxLength={200}
          aria-label="Title"
          placeholder="Untitled thought"
          className="h-[28px] min-w-0 flex-1 rounded-md border border-white/15 bg-black/20 px-2 text-[20px] leading-[28px] text-ink outline-none focus:border-white/40"
        />
        <button
          type="submit"
          disabled={saving}
          className="shrink-0 rounded-full bg-ember px-3 py-0.5 font-sans text-xs font-medium text-stone-950 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="shrink-0 font-sans text-xs text-stone-500 hover:text-stone-300"
        >
          Cancel
        </button>
        {error && (
          <span
            role="alert"
            className="shrink-0 font-sans text-xs text-rose-300"
          >
            {error}
          </span>
        )}
      </form>
    )
  }

  return (
    <h2 className="group/title flex min-w-0 items-baseline gap-2 text-[22px] leading-[30px] text-ink">
      <span className="truncate group-hover:underline">
        {title || "Untitled thought"}
      </span>
      <button
        type="button"
        onClick={start}
        aria-label="Rename this entry"
        title="Rename this entry"
        className="shrink-0 font-sans text-sm text-stone-500 opacity-0 transition hover:text-ember focus:opacity-100 group-hover/title:opacity-100"
      >
        ✎
      </button>
    </h2>
  )
}
