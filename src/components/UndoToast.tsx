"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

// "Entry deleted · Undo": shown after anything is deleted, for a few
// seconds. A delete on the server hands back a token (see features/undo);
// one in the browser (a discarded draft) passes `onUndo` instead.

export type UndoOffer = {
  label: string
  token?: string | null
  // put it back in the browser (instead of, or after, the server)
  onUndo?: () => void | Promise<void>
}

const EVENT = "undo:offer"
const SHOW_MS = 10_000

export function showUndo(offer: UndoOffer) {
  if (!offer.token && !offer.onUndo) return
  window.dispatchEvent(new CustomEvent<UndoOffer>(EVENT, { detail: offer }))
}

export function UndoToast() {
  const router = useRouter()
  const [offer, setOffer] = useState<UndoOffer | null>(null)
  const [state, setState] = useState<"ready" | "busy" | "done" | string>(
    "ready",
  )
  const timer = useRef<number | undefined>(undefined)

  const hideLater = useCallback((ms: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOffer(null), ms)
  }, [])

  useEffect(() => {
    const onOffer = (e: Event) => {
      setOffer((e as CustomEvent<UndoOffer>).detail)
      setState("ready")
      hideLater(SHOW_MS)
    }
    window.addEventListener(EVENT, onOffer)
    return () => window.removeEventListener(EVENT, onOffer)
  }, [hideLater])

  async function undo() {
    if (!offer || state !== "ready") return
    window.clearTimeout(timer.current)
    setState("busy")
    if (offer.token) {
      const res = await fetch("/api/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: offer.token }),
      }).catch(() => null)
      if (!res?.ok) {
        const data = await res?.json().catch(() => null)
        setState(data?.error ?? "Couldn't reach the app to undo it.")
        hideLater(6000)
        return
      }
    }
    await offer.onUndo?.()
    router.refresh()
    setState("done")
    hideLater(2500)
  }

  if (!offer) return null
  return (
    <div
      role="status"
      // above the Ask button on phones; clear of the home bar
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-[80] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 sm:bottom-6 lg:ml-28"
      onMouseEnter={() => window.clearTimeout(timer.current)}
      onMouseLeave={() => state === "ready" && hideLater(4000)}
      // held while you're on it with the keyboard, too
      onFocus={() => window.clearTimeout(timer.current)}
      onBlur={(e) =>
        !e.currentTarget.contains(e.relatedTarget) &&
        state === "ready" &&
        hideLater(4000)
      }
    >
      <p className="flex items-center gap-3 rounded-full border border-white/15 bg-stone-900/95 py-2 pl-4 pr-2 text-sm text-stone-100 shadow-xl shadow-black/50 backdrop-blur">
        {state === "done" ? (
          <span>
            <span className="text-ember">↺</span> Put back
          </span>
        ) : state !== "ready" && state !== "busy" ? (
          <span className="text-rose-300">{state}</span>
        ) : (
          <>
            <span>{offer.label}</span>
            <button
              type="button"
              onClick={undo}
              disabled={state === "busy"}
              className="rounded-full bg-ink px-3 py-1 pointer-coarse:py-2 text-xs font-medium text-stone-900 transition hover:bg-white disabled:opacity-50"
            >
              {state === "busy" ? "Undoing…" : "Undo"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setOffer(null)}
          aria-label="Dismiss"
          className="flex h-6 w-6 pointer-coarse:h-9 pointer-coarse:w-9 items-center justify-center rounded-full text-stone-500 hover:bg-white/10 hover:text-stone-200"
        >
          ×
        </button>
      </p>
    </div>
  )
}
