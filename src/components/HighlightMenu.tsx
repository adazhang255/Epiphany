"use client"

import { useEffect, useRef, useState } from "react"
import { CategoryPicker } from "@/components/CategoryPicker"
import { TrashIcon } from "@/components/TrashIcon"
import { OnTop } from "@/components/OnTop"
import { spotUnder } from "@/features/notes/lib/caret"

// The small menu for marking an entry's text where it's shown (the entry
// page, the notebook): select words to mark them as a type, or click a
// highlight to change its type or remove it. It opens just under where the
// selection ends (or under the highlight).

export type Highlight = { id: string; quote: string; category: string }

export type MenuState =
  | {
      kind: "new"
      text: string
      start: number // where the selected text is in the entry
      end: number
      top: number
      left: number
      flip: boolean
    }
  | {
      kind: "existing"
      id: string
      category: string
      top: number
      left: number
      flip: boolean
    }

// how many characters of `text` come before (node, offset)
function offsetIn(text: HTMLElement, node: Node, offset: number) {
  const r = document.createRange()
  r.selectNodeContents(text)
  r.setEnd(node, offset)
  return r.toString().length
}

// The menu for the words selected in `text` (an element holding exactly the
// entry's text), or null if nothing in it is selected.
export function menuForSelection(
  text: HTMLElement,
  host: HTMLElement,
): MenuState | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0)
    return null
  const range = selection.getRangeAt(0)
  if (!range.intersectsNode(text)) return null
  // a drag that started or ended outside the text counts up to its edge
  const whole = text.textContent?.length ?? 0
  const start = text.contains(range.startContainer)
    ? offsetIn(text, range.startContainer, range.startOffset)
    : 0
  const end = text.contains(range.endContainer)
    ? offsetIn(text, range.endContainer, range.endOffset)
    : whole
  const words = (text.textContent ?? "").slice(start, end)
  if (!words.trim()) return null
  // the end the cursor is at: where the drag finished
  const rects = range.getClientRects()
  const backward =
    selection.focusNode === range.startContainer &&
    selection.focusOffset === range.startOffset
  const rect =
    (backward ? rects[0] : rects[rects.length - 1]) ??
    range.getBoundingClientRect()
  return { kind: "new", text: words, start, end, ...spotUnder(rect, host, 6) }
}

export function menuForMark(
  mark: HTMLElement,
  host: HTMLElement,
  id: string,
  category: string,
): MenuState {
  const rects = mark.getClientRects()
  const rect = rects[rects.length - 1] ?? mark.getBoundingClientRect()
  return { kind: "existing", id, category, ...spotUnder(rect, host, 6) }
}

export function HighlightMenu({
  noteId,
  menu,
  custom,
  onClose,
  onChanged,
}: {
  noteId: string
  menu: MenuState
  custom: string[]
  onClose: () => void
  // the entry's highlights after the change
  onChanged: (highlights: Highlight[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const self = useRef<HTMLDivElement>(null)

  // clicking anywhere else closes it
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!self.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [onClose])

  async function send(url: string, init: RequestInit) {
    setBusy(true)
    setError("")
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json" },
    }).catch(() => null)
    const body = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      setError(body?.error ?? "Couldn’t save that.")
      return
    }
    window.getSelection()?.removeAllRanges()
    onChanged(body?.highlights ?? [])
    onClose()
  }

  return (
    <OnTop>
      <div
        ref={self}
        role="dialog"
        aria-label={
          menu.kind === "new" ? "Mark this passage" : "Change this highlight"
        }
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute z-[70] cursor-default rounded-xl border border-white/15 bg-stone-900/95 p-2 font-sans shadow-xl backdrop-blur"
        style={{
          top: menu.top,
          left: menu.left,
          transform: menu.flip ? "translateX(-100%)" : undefined,
        }}
      >
        <p className="px-1 pb-1.5 text-[11px] text-stone-500">
          {menu.kind === "new" ? "Mark as" : "Change to"}
        </p>
        <div className="flex w-max max-w-[min(26rem,88vw)] items-start gap-2">
          <div className="min-w-0 flex-1">
            <CategoryPicker
              custom={custom}
              disabled={busy}
              disabledFor={menu.kind === "existing" ? [menu.category] : []}
              // a new category for new words; changing a highlight picks one
              allowNew={menu.kind === "new"}
              onPick={(c) =>
                menu.kind === "new"
                  ? send(`/api/notes/${noteId}/highlights`, {
                      method: "POST",
                      body: JSON.stringify({
                        text: menu.text,
                        start: menu.start,
                        end: menu.end,
                        category: c,
                      }),
                    })
                  : send(`/api/highlights/${menu.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ category: c }),
                    })
              }
            />
          </div>
          {menu.kind === "existing" && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                // every highlight on these words, so none is left underneath
                send(`/api/highlights/${menu.id}?spot=1`, { method: "DELETE" })
              }
              aria-label="Remove highlight"
              title="Remove this highlight (the entry's text stays)"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-stone-400 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-40"
            >
              <TrashIcon />
            </button>
          )}
        </div>
        <div className="mt-1.5 flex justify-end gap-4 px-1 text-[11px]">
          <button
            type="button"
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300"
          >
            Close
          </button>
        </div>
        {error && (
          <p className="mt-1 max-w-64 px-1 text-[11px] text-rose-300/80">
            {error}
          </p>
        )}
      </div>
    </OnTop>
  )
}
