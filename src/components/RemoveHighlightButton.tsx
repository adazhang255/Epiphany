"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { TrashIcon } from "@/components/TrashIcon"

// Remove a highlight from the lists. The entry's text isn't touched: a
// highlight is only a marker on it. Asks first, in a small box by the ×.
function RemoveHighlightButtonInner({
  id,
  className = "",
}: {
  id: string
  className?: string
}) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)

  // clicking anywhere else closes the question
  useEffect(() => {
    if (!asking) return
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setAsking(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [asking])

  async function remove() {
    setBusy(true)
    await fetch(`/api/highlights/${id}`, { method: "DELETE" }).catch(() => null)
    setBusy(false)
    setAsking(false)
    router.refresh()
  }

  return (
    <span ref={anchor} className={`absolute z-10 ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setAsking((a) => !a)
        }}
        aria-label="Remove this highlight"
        title="Remove this highlight (the entry stays as it is)"
        className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
          asking
            ? "bg-rose-400/20 text-rose-200"
            : "text-stone-500 opacity-0 hover:bg-white/10 hover:text-rose-300 focus:opacity-100 group-hover/hl:opacity-100"
        }`}
      >
        <TrashIcon size={13} />
      </button>
      {asking && (
        <span
          role="alertdialog"
          aria-label="Remove this highlight?"
          className="absolute right-0 top-full mt-1 flex items-center gap-2 whitespace-nowrap rounded-md border border-rose-400/40 bg-stone-900 px-2 py-1 font-mono text-[11px] shadow-xl shadow-black/50"
        >
          <span className="text-rose-200">
            Remove this highlight? The entry&apos;s text stays.
          </span>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="rounded px-2 py-0.5 text-stone-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded bg-rose-400 px-2 py-0.5 font-bold text-stone-950 disabled:opacity-50"
          >
            {busy ? "Removing…" : "Remove"}
          </button>
        </span>
      )}
    </span>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function RemoveHighlightButton(
  props: React.ComponentProps<typeof RemoveHighlightButtonInner>,
) {
  return usePublicView() ? null : <RemoveHighlightButtonInner {...props} />
}
