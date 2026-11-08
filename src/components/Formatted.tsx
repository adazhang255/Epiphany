import {
  BOLD,
  BULLET,
  HEADING,
  ITALIC,
  MARKER,
  QUOTE,
  QUOTE_MARK,
  SUBHEADING,
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
    if (run.flags & QUOTE_MARK)
      node = (
        <span key={i} className="md-quote-mark">
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

// The text you're writing, formatted as you type: drawn under a text box
// whose own letters are see-through (see .live-text), laid out identically.
// So every character keeps its exact width (wrapping and the cursor stay in
// line with the box): the markers stay, dimmed; bold is drawn thicker
// rather than with a wider face, italic slanted, headings bright and bold
// at the line's size. `parts`: the text in pieces, some tinted (highlights
// you've marked).
export function LiveFormatted({
  parts,
}: {
  parts: { text: string; color?: string; style?: React.CSSProperties }[]
}) {
  const text = parts.map((p) => p.text).join("")
  const flags = formatFlags(text)
  const out: React.ReactNode[] = []
  let at = 0
  for (const part of parts) {
    const end = at + part.text.length
    const pieces = formatRuns(text, flags, at, end).map((run, i) => {
      const f = run.flags
      const slanted = f & (ITALIC | QUOTE) && !(f & (MARKER | QUOTE_MARK))
      const className = [
        f & (MARKER | QUOTE_MARK) && "live-marker",
        f & BULLET && "live-bullet",
        f & BOLD && "live-bold",
        f & (HEADING | SUBHEADING) && "live-heading",
        f & QUOTE && "live-quote",
      ]
        .filter(Boolean)
        .join(" ")
      return (
        <span key={`${at}-${i}`} className={className || undefined}>
          {slanted
            ? // word by word, so the lines still break between words
              run.text.split(/(\s+)/).map((word, j) =>
                word && !/^\s+$/.test(word) ? (
                  <span key={j} className="live-slant">
                    {word}
                  </span>
                ) : (
                  word
                ),
              )
            : run.text}
        </span>
      )
    })
    out.push(
      part.style ? (
        <span key={at} className="rounded-sm" style={part.style}>
          {pieces}
        </span>
      ) : (
        pieces
      ),
    )
    at = end
  }
  return out
}
