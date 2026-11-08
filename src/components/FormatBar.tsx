"use client"

// Formatting for an entry's text box: bold, italic, bullets, headings and
// quotes, as buttons and ⌘B / ⌘I / ⌘⇧8 / ⌘⌥1 / ⌘⇧. ; Enter on a bullet line
// starts the next one. They write the Markdown markers into the text (see
// lib/markdown), as typing them would, so ⌘Z undoes them and highlights
// follow the text as usual. Preview shows the text formatted.

import {
  continueList,
  cycleHeading,
  toggleBullets,
  toggleLines,
  toggleWrap,
  type TextEdit,
} from "@/features/notes/lib/markdownEdit"

type Box = React.RefObject<HTMLTextAreaElement | null>

// Make an edit as one the browser can undo (with a fallback where it can't),
// then select what it says.
function apply(el: HTMLTextAreaElement, edit: TextEdit | null) {
  if (!edit) return false
  const { start, end, insert, from, to } = edit
  el.focus()
  el.setSelectionRange(start, end)
  let done = false
  try {
    done = document.execCommand("insertText", false, insert)
  } catch {}
  if (!done || el.value.slice(start, start + insert.length) !== insert) {
    el.setRangeText(insert, start, end)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }
  el.setSelectionRange(from, to)
  return true
}

const bold = (el: HTMLTextAreaElement) =>
  apply(el, toggleWrap(el.value, el.selectionStart, el.selectionEnd, "**"))
const italic = (el: HTMLTextAreaElement) =>
  apply(el, toggleWrap(el.value, el.selectionStart, el.selectionEnd, "*"))
const bullets = (el: HTMLTextAreaElement) =>
  apply(el, toggleBullets(el.value, el.selectionStart, el.selectionEnd))
const heading = (el: HTMLTextAreaElement) =>
  apply(el, cycleHeading(el.value, el.selectionStart, el.selectionEnd))
const quote = (el: HTMLTextAreaElement) =>
  apply(el, toggleLines(el.value, el.selectionStart, el.selectionEnd, "quote"))

// For the text box's onKeyDown: true if the key was a formatting one.
export function formatKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
): boolean {
  const el = e.currentTarget
  const mod = e.metaKey || e.ctrlKey
  const key = e.key.toLowerCase()
  let done = false
  if (mod && !e.shiftKey && !e.altKey && key === "b") done = bold(el)
  else if (mod && !e.shiftKey && !e.altKey && key === "i") done = italic(el)
  else if (mod && e.shiftKey && (e.code === "Digit8" || key === "*"))
    done = bullets(el)
  else if (mod && e.altKey && e.code === "Digit1") done = heading(el)
  else if (mod && e.shiftKey && e.code === "Period") done = quote(el)
  else if (
    key === "enter" &&
    !mod &&
    !e.shiftKey &&
    !e.altKey &&
    !e.nativeEvent.isComposing
  )
    done = apply(el, continueList(el.value, el.selectionStart, el.selectionEnd))
  if (done) e.preventDefault()
  return done
}

const TOOLS = [
  { label: "Bold", keys: "⌘B", face: "B", style: "font-bold", act: bold },
  {
    label: "Italic",
    keys: "⌘I",
    face: "I",
    style: "italic font-serif",
    act: italic,
  },
  {
    label: "Heading (again for a smaller one, again for none)",
    keys: "⌘⌥1",
    face: "H",
    style: "font-serif font-semibold",
    act: heading,
  },
  { label: "Bullet list", keys: "⌘⇧8", face: "•", style: "", act: bullets },
  { label: "Quote", keys: "⌘⇧.", face: "❝", style: "font-serif", act: quote },
]

// The buttons, and Preview (the text formatted, instead of the text box).
// They keep the focus (and the selection) in the text box.
export function FormatBar({
  box,
  preview,
  onPreview,
  className = "",
}: {
  box: Box
  // shown formatted instead of the text box (Preview), if the editor offers it
  preview?: boolean
  onPreview?: (on: boolean) => void
  className?: string
}) {
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={`flex items-center gap-0.5 ${className}`}
    >
      {TOOLS.map((t) => (
        <button
          key={t.label}
          type="button"
          title={`${t.label} (${t.keys})`}
          aria-label={t.label}
          disabled={preview}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => box.current && t.act(box.current)}
          className={`flex h-6 w-6 pointer-coarse:h-9 pointer-coarse:w-9 items-center justify-center rounded-md font-sans text-sm text-stone-400 transition hover:bg-white/10 hover:text-stone-100 disabled:opacity-30 disabled:hover:bg-transparent ${t.style}`}
        >
          {t.face}
        </button>
      ))}
      {onPreview && (
        <button
          type="button"
          aria-pressed={preview}
          title={preview ? "Back to writing" : "See it formatted"}
          onClick={() => {
            onPreview(!preview)
            // back to writing: where you were
            if (preview) requestAnimationFrame(() => box.current?.focus())
          }}
          className={`ml-1 rounded-md px-2 py-0.5 pointer-coarse:py-2 font-mono text-[10px] uppercase tracking-widest transition ${
            preview
              ? "bg-ember/20 text-ember"
              : "text-stone-500 hover:bg-white/10 hover:text-stone-200"
          }`}
        >
          {preview ? "Edit" : "Preview"}
        </button>
      )}
    </div>
  )
}
