"use client"

import { useState } from "react"
import {
  categoryColor,
  categoryGlyph,
  cleanCategoryName,
  HIGHLIGHT_CATEGORIES,
} from "@/features/notes/lib/topics"

// The built-in types, any categories you've made, and "+ New" to make one
// (left out with allowNew={false}, e.g. when changing a highlight's type).
// `selected` marks the chosen ones (e.g. an entry's own categories).
export function CategoryPicker({
  custom,
  selected = [],
  disabledFor = [],
  disabled = false,
  withQuestion = true,
  allowNew = true,
  onPick,
}: {
  // categories of your own already in use
  custom: string[]
  selected?: string[]
  // can't be picked (e.g. the type a highlight already has)
  disabledFor?: string[]
  disabled?: boolean
  // Question is a highlight type, not an entry category
  withQuestion?: boolean
  // offer "+ New" to make a category
  allowNew?: boolean
  onPick: (name: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const all = [
    ...HIGHLIGHT_CATEGORIES.filter((c) => withQuestion || c !== "Question"),
    ...custom,
    // a name just made here, before it's saved anywhere
    ...selected.filter(
      (s) =>
        !custom.includes(s) &&
        !(HIGHLIGHT_CATEGORIES as readonly string[]).includes(s),
    ),
  ]

  function add() {
    const clean = cleanCategoryName(name)
    if (!clean) return
    onPick(clean)
    setName("")
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {all.map((c) => {
        const on = selected.includes(c)
        return (
          <button
            key={c}
            type="button"
            aria-pressed={selected.length ? on : undefined}
            disabled={disabled || disabledFor.includes(c)}
            onClick={() => onPick(c)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition disabled:opacity-40 ${
              on
                ? "bg-white/15 text-ink ring-1 ring-white/30"
                : "text-stone-200 hover:bg-white/10"
            }`}
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ background: categoryColor(c) }}
            />
            {categoryGlyph(c)} {c}
          </button>
        )
      })}
      {allowNew &&
        (adding ? (
          <span className="flex items-center gap-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  add()
                }
                if (e.key === "Escape") {
                  e.preventDefault() // closes this, not the editor around it
                  setAdding(false)
                }
              }}
              autoFocus
              maxLength={24}
              placeholder="New category"
              aria-label="New category name"
              className="w-32 rounded-md border border-white/15 bg-transparent px-2 py-1 text-xs text-stone-100 outline-none focus:border-white/40"
            />
            <button
              type="button"
              onClick={add}
              disabled={!cleanCategoryName(name)}
              className="rounded-md bg-white/10 px-2 py-1 text-xs text-stone-100 disabled:opacity-40"
            >
              Add
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAdding(true)}
            className="rounded-lg border border-dashed border-white/15 px-2 py-1 text-xs text-stone-400 hover:text-stone-200"
          >
            + New
          </button>
        ))}
    </div>
  )
}
