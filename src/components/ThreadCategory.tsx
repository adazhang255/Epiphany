"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { CategoryPicker } from "@/components/CategoryPicker"
import { PILL, PILL_ON } from "@/components/buttonStyles"
import {
  categoryColor,
  categoryGlyph,
  highlightType,
} from "@/features/notes/lib/topics"
import { usePublicView } from "@/components/usePublicView"
import type { ThreadRef } from "@/features/threads/membership"

// A thread's category, like a highlight's type: shown as its kind, and
// clicked to change it (or "+ Category" while it has none).
export function ThreadCategory({
  thread,
  category,
  custom,
}: {
  thread: ThreadRef
  category: string | null
  // categories of your own already in use
  custom: string[]
}) {
  const router = useRouter()
  const readOnly = usePublicView()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const anchor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  async function set(next: string | null) {
    setBusy(true)
    setError("")
    const res = await fetch("/api/threads/category", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread, category: next }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) return setError("Couldn’t save that.")
    setOpen(false)
    router.refresh()
  }

  if (readOnly)
    return category ? (
      <span className={PILL}>
        <Kind category={category} />
      </span>
    ) : null
  return (
    <span ref={anchor} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={
          category
            ? "Change this thread’s category"
            : "Give this thread a category"
        }
        className={open ? PILL_ON : PILL}
      >
        {category ? <Kind category={category} /> : "+ Category"}
      </button>
      {open && (
        <span
          role="dialog"
          aria-label="Thread category"
          className="absolute left-0 top-full z-30 mt-1 block w-max max-w-[min(26rem,88vw)] rounded-xl border border-white/15 bg-stone-900/95 p-2 shadow-xl shadow-black/50 backdrop-blur"
        >
          <span className="block px-1 pb-1.5 text-[11px] text-stone-500">
            {category ? "Change to" : "Category"}
          </span>
          <CategoryPicker
            custom={custom}
            disabled={busy}
            disabledFor={category ? [category] : []}
            onPick={(c) => set(c)}
          />
          {category && (
            <button
              type="button"
              disabled={busy}
              onClick={() => set(null)}
              className="mt-1.5 px-1 text-[11px] text-stone-500 hover:text-rose-300"
            >
              Remove category
            </button>
          )}
          {error && (
            <span className="mt-1 block px-1 text-[11px] text-rose-300">
              {error}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

// the category as the other buttons write: its colour dot, symbol and name
function Kind({ category }: { category: string }) {
  const type = highlightType(category)
  return (
    <>
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: categoryColor(type) }}
      />
      {categoryGlyph(type)} {type}
    </>
  )
}
