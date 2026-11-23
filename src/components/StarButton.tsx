"use client"

import { useState } from "react"

// A star to keep an entry among your favourites: filled when it is. It
// changes at once and is saved behind; if saving fails it goes back.
export function StarButton({
  noteId,
  starred: initial,
  onChange,
  className = "",
}: {
  noteId: string
  starred: boolean
  // once the change is saved (e.g. to update the Starred list)
  onChange?: (starred: boolean) => void
  className?: string
}) {
  const [starred, setStarred] = useState(initial)
  async function toggle() {
    const next = !starred
    setStarred(next)
    const res = await fetch(`/api/notes/${noteId}/star`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: next }),
    }).catch(() => null)
    if (!res?.ok) return setStarred(!next)
    onChange?.(next)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={starred}
      aria-label={
        starred ? "Starred (take the star off)" : "Star as a favourite"
      }
      title={
        starred ? "Starred: click to take the star off" : "Star as a favourite"
      }
      className={`leading-none transition ${
        starred
          ? "text-ember hover:brightness-110"
          : "text-stone-500 hover:text-ember"
      } ${className}`}
    >
      {starred ? "★" : "☆"}
    </button>
  )
}
