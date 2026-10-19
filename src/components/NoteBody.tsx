"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import { useEntryParams } from "@/components/EntryParams"
import {
  HighlightMenu,
  menuForMark,
  menuForSelection,
  type MenuState,
} from "@/components/HighlightMenu"
import {
  categoryColor,
  categoryGlyph,
  highlightType,
} from "@/features/notes/lib/topics"

export type BodyPart =
  | { text: string }
  | { text: string; quote: { id: string; category: string; manual: boolean } }

// hex color + alpha → rgba for the tinted background
function tint(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// The entry's text with its highlights, each tinted by type. Select any
// passage to mark it yourself; click a highlight to change or remove it.
export function NoteBody({
  noteId,
  parts,
  custom = [],
}: {
  noteId: string
  parts: BodyPart[]
  // categories of your own, offered alongside the built-in types
  custom?: string[]
}) {
  const router = useRouter()
  const readOnly = usePublicView()
  const { activeId, justSaved } = useEntryParams()
  const box = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  // highlights present when the page opened; any that arrive later (found
  // in the background, or marked by you) sweep in as they appear
  const [initialIds] = useState(
    () => new Set(parts.flatMap((p) => ("quote" in p ? [p.quote.id] : []))),
  )
  const close = useCallback(() => setMenu(null), [])

  function onMouseUp() {
    if (readOnly) return
    if (!text.current || !box.current) return
    const next = menuForSelection(text.current, box.current)
    if (next) setMenu(next)
  }

  return (
    <div ref={box} className="relative" onMouseUp={onMouseUp}>
      <div
        ref={text}
        className="mt-10 whitespace-pre-wrap font-serif text-[19px] leading-[1.8] text-stone-300"
      >
        {parts.map((part, i) => {
          if (!("quote" in part)) return <span key={i}>{part.text}</span>
          const type = highlightType(part.quote.category)
          const fresh = justSaved || !initialIds.has(part.quote.id)
          const color = categoryColor(type)
          return (
            <mark
              key={i}
              id={`h-${part.quote.id}`}
              title={`${categoryGlyph(type)} ${type}${part.quote.manual ? " (yours)" : ""}${readOnly ? "" : ": click to change"}`}
              className={`note-mark scroll-mt-40 ${readOnly ? "" : "cursor-pointer"} ${fresh ? "note-mark-new" : ""}`}
              data-active={part.quote.id === activeId}
              style={
                {
                  "--mark-bg": tint(color, 0.16),
                  "--mark-bg-strong": tint(color, 0.4),
                  "--mark-line": tint(color, 0.85),
                  ...(justSaved
                    ? { animationDelay: `${300 + Math.floor(i / 2) * 350}ms` }
                    : {}),
                } as React.CSSProperties
              }
              onClick={(e) => {
                if (readOnly || window.getSelection()?.toString()) return
                setMenu(
                  menuForMark(
                    e.currentTarget,
                    box.current!,
                    part.quote.id,
                    type,
                  ),
                )
              }}
            >
              {part.text}
            </mark>
          )
        })}
      </div>

      {menu && (
        <HighlightMenu
          noteId={noteId}
          menu={menu}
          custom={custom}
          onClose={close}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  )
}
