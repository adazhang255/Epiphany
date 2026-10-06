import {
  categoryColor,
  categoryGlyph,
  highlightType,
} from "@/features/notes/lib/topics"

// A highlight's type (Writing / Insight / Event / Emotion / Question):
// colored dot + symbol + name, so color is never the only cue.
export function HighlightKind({
  category,
  manual = false,
}: {
  category: string
  manual?: boolean
}) {
  const type = highlightType(category)
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-stone-400">
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: categoryColor(type) }}
      />
      {categoryGlyph(type)} {type}
      {manual && <span className="text-stone-600">· yours</span>}
    </span>
  )
}
