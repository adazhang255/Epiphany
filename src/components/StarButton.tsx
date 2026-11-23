"use client"

import { useState } from "react"
import type { ThreadRef } from "@/features/threads/membership"

// A star to keep an entry (or a highlight, or a thread) among your favourites: filled
// when it is. It changes at once and is saved behind; if saving fails it
// goes back.
export function StarButton({
  noteId,
  highlightId,
  thread,
  starred: initial,
  onChange,
  className = "",
}: {
  noteId?: string
  highlightId?: string
  thread?: ThreadRef
  starred: boolean
  // once the change is saved (e.g. to update the Starred list)
  onChange?: (starred: boolean) => void
  className?: string
}) {
  const [starred, setStarred] = useState(initial)
  async function toggle() {
    const next = !starred
    setStarred(next)
    const url = thread
      ? "/api/threads/star"
      : highlightId
        ? `/api/highlights/${highlightId}/star`
        : `/api/notes/${noteId}/star`
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        thread ? { thread, starred: next } : { starred: next },
      ),
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
