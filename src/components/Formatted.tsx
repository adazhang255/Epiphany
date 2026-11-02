import {
  BOLD,
  BULLET,
  ITALIC,
  MARKER,
  formatRuns,
} from "@/features/notes/lib/markdown"

// Part of an entry's text (`start` to `end` of the whole `text`), formatted:
// bold, italic and bullets shown, their markers hidden but still in the page
// (so the page's text is exactly the entry's; see lib/markdown).
export function Formatted({
  text,
  flags,
  start = 0,
  end = text.length,
}: {
  text: string
  flags: Uint8Array // formatFlags(text)
  start?: number
  end?: number
}) {
  return formatRuns(text, flags, start, end).map((run, i) => {
    if (run.flags & MARKER)
      return (
        <span key={i} className="md-marker">
          {run.text}
        </span>
      )
    let node: React.ReactNode = run.text
    if (run.flags & BULLET)
      node = (
        <span key={i} className="md-bullet">
          {run.text}
        </span>
      )
    if (run.flags & ITALIC) node = <em key={i}>{node}</em>
    if (run.flags & BOLD)
      node = (
        <strong key={i} className="font-semibold text-stone-100">
          {node}
        </strong>
      )
    return typeof node === "string" ? <span key={i}>{node}</span> : node
  })
}
