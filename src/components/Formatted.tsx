import {
  BOLD,
  BULLET,
  HEADING,
  ITALIC,
  MARKER,
  QUOTE,
  QUOTE_MARK,
  RULE,
  STRIKE,
  SUBHEADING,
  UNDERLINE,
  formatFlags,
  formatRuns,
} from "@/features/notes/lib/markdown"

// Part of an entry's text (`start` to `end` of the whole `text`), formatted:
// bold, italic, bullets, headings and quotes shown, their markers hidden but
// still in the page (so the page's text is exactly the entry's; see
// lib/markdown).
export function Formatted({
  text,
  flags,
  start = 0,
  end = text.length,
}: {
  text: string
  flags: Uint16Array // formatFlags(text)
  start?: number
  end?: number
}) {
  return formatRuns(text, flags, start, end).map((run, i) => {
    // a divider: its dashes kept in the page, hidden, with a line across
    if (run.flags & RULE)
      return (
        <span key={i} className="md-rule">
          {run.text}
        </span>
      )
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
    if (run.flags & QUOTE_MARK)
      node = (
        <span key={i} className="md-quote-mark">
          {run.text}
        </span>
      )
    if (run.flags & ITALIC) node = <em key={i}>{node}</em>
    if (run.flags & STRIKE)
      node = (
        <s key={i} className="md-strike">
          {node}
        </s>
      )
    if (run.flags & UNDERLINE)
      node = (
        <u key={i} className="md-underline">
          {node}
        </u>
      )
    if (run.flags & BOLD)
      node = (
        <strong key={i} className="font-semibold text-stone-100">
          {node}
        </strong>
      )
    if (run.flags & QUOTE)
      node = (
        <span key={i} className="md-quote">
          {node}
        </span>
      )
    if (run.flags & (HEADING | SUBHEADING))
      node = (
        <span key={i} className={run.flags & HEADING ? "md-h1" : "md-h2"}>
          {node}
        </span>
      )
    return typeof node === "string" ? <span key={i}>{node}</span> : node
  })
}

// A whole text, formatted (e.g. the preview while writing).
export function FormattedText({ text }: { text: string }) {
  return <Formatted text={text} flags={formatFlags(text)} />
}
