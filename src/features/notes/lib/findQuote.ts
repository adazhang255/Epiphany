export type QuoteRange = { start: number; end: number }

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Locate a highlight inside the note body. Tolerates differences in case,
// whitespace and curly vs straight quotes, which LLMs tend to introduce, and
// formatting markers in the text that the highlight is kept without.
export function findQuote(content: string, quote: string): QuoteRange | null {
  const trimmed = quote
    .trim()
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim()
  if (!trimmed) {
    return null
  }

  const exact = content.indexOf(trimmed)
  if (exact >= 0) {
    return { start: exact, end: exact + trimmed.length }
  }

  // formatting markers (**bold**, *italic*, a line's "# " or "> ") in the
  // text may sit between the quote's characters: highlights are kept
  // without them
  const formatted = /[*_#>]/.test(content) && !/[*_]/.test(trimmed)
  const char = (c: string) =>
    escapeRegExp(c).replace(/["“”]/g, '["“”]').replace(/['‘’]/g, "['‘’]")
  const pattern = trimmed
    .split(/\s+/)
    .map((word) =>
      formatted ? [...word].map(char).join("[*_]{0,2}") : char(word),
    )
    // (and a line's "# " or "> " after a line break)
    .join(formatted ? "[*_]*\\s+(?:[#>]+[ \\t]*)?[*_]*" : "\\s+")
  const match = new RegExp(pattern, "i").exec(content)

  return match
    ? { start: match.index, end: match.index + match[0].length }
    : null
}

// Grow a range to whole words, so a drag that starts or ends mid-word
// ("w anyone here yet. Walked t") highlights "know anyone here yet. Walked to".
const inWord = (ch: string | undefined) => !!ch && /[\p{L}\p{N}'’-]/u.test(ch)

export function snapToWords(content: string, range: QuoteRange): QuoteRange {
  let { start, end } = range
  // drop leading/trailing spaces first
  while (start < end && /\s/.test(content[start])) start++
  while (end > start && /\s/.test(content[end - 1])) end--
  while (start > 0 && inWord(content[start - 1]) && inWord(content[start]))
    start--
  while (
    end < content.length &&
    inWord(content[end - 1]) &&
    inWord(content[end])
  )
    end++
  return { start, end }
}
