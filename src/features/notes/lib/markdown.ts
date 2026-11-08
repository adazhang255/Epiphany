import { findQuote } from "@/features/notes/lib/findQuote"

// Formatting in an entry's text, written the Markdown way: **bold**,
// *italic* (or _italic_), and at the start of a line "- " (or "* ") for a
// bullet, "# " for a heading ("## " or "### " a smaller one) and "> " for a
// quote. The text is stored just as written; the markers are hidden when
// it's shown but stay in the page, so a character's place on screen is its
// place in the text (highlights and selections rely on that).

export const BOLD = 1
export const ITALIC = 2
export const MARKER = 4 // a ** or * or _ that is hidden when shown
export const BULLET = 8 // the "-" of a bullet line, shown as "•"
export const HEADING = 16 // a "# " line
export const SUBHEADING = 32 // a "## " or "### " line
export const QUOTE = 64 // a "> " line
export const QUOTE_MARK = 128 // its ">", shown as a bar

const HEADING_LINE = /^(#{1,3})[ \t]+(?=\S)[^\n]*/gm
const QUOTE_LINE = /^>([ \t]?)[^\n]*/gm

const BULLET_LINE = /^([ \t]*)([-*])[ \t]+(?=\S)/gm
const BOLD_RUN = /\*\*(?=\S)([^\n]*?\S)\*\*/g
const ITALIC_RUN =
  /(?<![\p{L}\p{N}*_])([*_])(?=[^\s*_])([^\n]*?[^\s*_])\1(?![\p{L}\p{N}*_])/gu

// One set of flags per character of `text`.
export function formatFlags(text: string): Uint8Array {
  const flags = new Uint8Array(text.length)
  // markers already claimed are blanked out (same length) for later passes
  let rest = text
  const blank = (start: number, end: number) => {
    rest = rest.slice(0, start) + "\0".repeat(end - start) + rest.slice(end)
  }

  for (const m of text.matchAll(HEADING_LINE)) {
    const start = m.index
    const marker = /^#+[ \t]+/.exec(m[0])![0].length
    const kind = m[1].length === 1 ? HEADING : SUBHEADING
    for (let i = start; i < start + m[0].length; i++) flags[i] |= kind
    for (let i = start; i < start + marker; i++) flags[i] |= MARKER
    blank(start, start + marker)
  }
  for (const m of text.matchAll(QUOTE_LINE)) {
    const start = m.index
    for (let i = start; i < start + m[0].length; i++) flags[i] |= QUOTE
    flags[start] |= QUOTE_MARK
    if (m[1]) flags[start + 1] |= MARKER
    blank(start, start + 1 + m[1].length)
  }
  for (const m of rest.matchAll(BULLET_LINE)) {
    const at = m.index + m[1].length
    flags[at] |= BULLET
    blank(at, at + 1)
  }
  for (const m of [...rest.matchAll(BOLD_RUN)]) {
    const start = m.index
    const end = start + m[0].length
    for (let i = start; i < end; i++) flags[i] |= BOLD
    flags[start] |= MARKER
    flags[start + 1] |= MARKER
    flags[end - 2] |= MARKER
    flags[end - 1] |= MARKER
    blank(start, start + 2)
    blank(end - 2, end)
  }
  // (a blanked bold marker counts as neither a letter nor a marker here, so
  // "*a **b** c*" is italic around the bold)
  for (const m of [...rest.matchAll(ITALIC_RUN)]) {
    const start = m.index
    const end = start + m[0].length
    for (let i = start; i < end; i++) flags[i] |= ITALIC
    flags[start] |= MARKER
    flags[end - 1] |= MARKER
  }
  return flags
}

export type FormatRun = { text: string; flags: number }

// `text` from `start` to `end`, cut where its formatting changes.
export function formatRuns(
  text: string,
  flags: Uint8Array,
  start = 0,
  end = text.length,
): FormatRun[] {
  const runs: FormatRun[] = []
  let from = start
  for (let i = start + 1; i <= end; i++) {
    if (i === end || flags[i] !== flags[from]) {
      runs.push({ text: text.slice(from, i), flags: flags[from] })
      from = i
    }
  }
  return runs
}

// marks that aren't part of the words: hidden markers, and a quote's ">"
const NOT_WORDS = MARKER | QUOTE_MARK

// The text without its formatting markers (bullets are kept): how a
// highlight or a question taken from it is stored and shown.
export function stripInline(text: string) {
  const flags = formatFlags(text)
  let out = ""
  for (let i = 0; i < text.length; i++) {
    if (flags[i] & NOT_WORDS) continue
    out += text[i]
  }
  // a marker cut off from its pair (a highlight ending mid-bold)
  return out.replace(/^\*\*(?=\S)|(?<=\S)\*\*$/g, "")
}

// For a snippet: no markers, and bullets as "•".
export function plainText(text: string) {
  return stripInline(text).replace(/^([ \t]*)[-*][ \t]+(?=\S)/gm, "$1• ")
}

// The text as it's shown, for export: runs with their formatting, the
// markers left out and bullets as "•". (heading: 1 for "# ", 2 for "## ")
export function shownRuns(text: string) {
  return formatRuns(text, formatFlags(text))
    .filter((run) => !(run.flags & NOT_WORDS))
    .map((run) => ({
      text: run.flags & BULLET ? "•" : run.text,
      bold: Boolean(run.flags & BOLD),
      italic: Boolean(run.flags & ITALIC),
      heading: run.flags & HEADING ? 1 : run.flags & SUBHEADING ? 2 : 0,
      quote: Boolean(run.flags & QUOTE),
    }))
}

// `text` from `start` to `end` without its formatting markers, read from the
// whole text (a highlight can start or end inside **bold**, where its own
// words alone wouldn't show which stars are markers).
export function stripRange(text: string, start: number, end: number) {
  const flags = formatFlags(text)
  let out = ""
  for (let i = start; i < end; i++) if (!(flags[i] & NOT_WORDS)) out += text[i]
  return out
}

// A highlight's words as kept: as they are in `content` without markers,
// or (not found there) without the markers they carry themselves.
export function quoteIn(content: string, quote: string) {
  const range = findQuote(content, quote)
  return range
    ? stripRange(content, range.start, range.end).trim()
    : stripInline(quote).trim()
}
