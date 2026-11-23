"use client"

// The formatting buttons over an entry's box (see RichText, which also has
// them as shortcuts): bold, italic, underline, strikethrough, heading,
// bullets, numbered lines, quote and a divider. They keep the focus (and
// the selection) in the box.

import type { RichHandle, Tool } from "@/components/RichText"

const TOOLS: {
  tool: Tool
  label: string
  keys: string
  face: string
  style: string
}[] = [
  { tool: "bold", label: "Bold", keys: "⌘B", face: "B", style: "font-bold" },
  {
    tool: "italic",
    label: "Italic",
    keys: "⌘I",
    face: "I",
    style: "italic font-serif",
  },
  {
    tool: "underline",
    label: "Underline",
    keys: "⌘U",
    face: "U",
    style: "underline underline-offset-2",
  },
  {
    tool: "strike",
    label: "Strikethrough",
    keys: "⌘⇧X",
    face: "S",
    style: "line-through",
  },
  {
    tool: "heading",
    label: "Heading (again for a smaller one, again for none)",
    keys: "⌘⌥1",
    face: "H",
    style: "font-serif font-semibold",
  },
  { tool: "bullet", label: "Bullet list", keys: "⌘⇧8", face: "•", style: "" },
  {
    tool: "numbered",
    label: "Numbered list",
    keys: "⌘⇧7",
    face: "1.",
    style: "text-xs",
  },
  {
    tool: "quote",
    label: "Quote",
    keys: "⌘⇧.",
    face: "❝",
    style: "font-serif",
  },
  { tool: "rule", label: "Divider", keys: "or type ---", face: "—", style: "" },
]

export function FormatBar({
  editor,
  className = "",
}: {
  editor: React.RefObject<RichHandle | null>
  className?: string
}) {
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={`flex flex-wrap items-center gap-0.5 ${className}`}
    >
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          type="button"
          title={`${t.label} (${t.keys})`}
          aria-label={t.label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.current?.run(t.tool)}
          className={`flex h-6 w-6 items-center justify-center rounded-md font-sans text-sm text-stone-400 transition hover:bg-white/10 hover:text-stone-100 pointer-coarse:h-9 pointer-coarse:w-9 ${t.style}`}
        >
          {t.face}
        </button>
      ))}
    </div>
  )
}
