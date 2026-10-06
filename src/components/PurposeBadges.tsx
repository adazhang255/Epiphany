import { categoryColor, categoryGlyph } from "@/features/notes/lib/topics"

// An entry's category (why it was written) is the top tag level: solid
// uppercase pills in the category's color, above the quiet #tags.
export function PurposeBadges({
  purposes,
  className = "",
}: {
  purposes: string[]
  className?: string
}) {
  if (purposes.length === 0) return null
  return (
    <ul aria-label="Category" className={`flex flex-wrap gap-1.5 ${className}`}>
      {purposes.map((name) => {
        return (
          <li
            key={name}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-stone-950"
            style={{ background: categoryColor(name) }}
          >
            <span aria-hidden>{categoryGlyph(name)}</span>
            {name}
          </li>
        )
      })}
    </ul>
  )
}
