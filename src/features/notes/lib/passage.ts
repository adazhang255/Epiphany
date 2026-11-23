// How long a highlight is: 1 or 2 sentences, short enough to read whole on
// the Highlights page (HIGHLIGHT_CHARS stands in for "2 sentences" when the
// writing has little punctuation).
export const HIGHLIGHT_SENTENCES = 2
export const HIGHLIGHT_CHARS = 220

// A passage cut down to its first `sentences` sentences, at most `chars`
// long (at a sentence's end if one fits, otherwise a word's). Cutting the
// end off a verbatim passage keeps it verbatim.
export function clampPassage(
  text: string,
  sentences = HIGHLIGHT_SENTENCES,
  chars = HIGHLIGHT_CHARS,
) {
  const ends = [...text.matchAll(/[.!?…]+["”’)]*(?=\s|$)/g)].map(
    (m) => m.index + m[0].length,
  )
  let cut = text.length
  if (ends.length > sentences) cut = ends[sentences - 1]
  if (cut > chars) {
    const lastSentence = ends.filter((e) => e <= chars).at(-1)
    cut = lastSentence ?? text.lastIndexOf(" ", chars)
  }
  return text.slice(0, cut > 0 ? cut : chars).trim()
}

// A highlight as the Highlights page shows it: whole if it's short enough,
// otherwise its opening, ending "…" (older highlights could be longer; the
// whole of it is on its entry's page).
export function shortPassage(text: string) {
  const short = clampPassage(text)
  if (short.length >= text.trim().length) return { text: short, cut: false }
  // ("…" takes the place of a closing full stop)
  return { text: short.replace(/[\s,;:—–.-]+$/, ""), cut: true }
}
