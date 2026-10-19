// Search by words, in the browser: entries and highlights containing every
// word typed (any case). The public site searches this way; locally the
// server also matches by meaning (see topic.ts and useTopicSearch).

export const searchWords = (q: string) =>
  q
    .toLowerCase()
    .split(/[^\p{L}\p{N}'’]+/u)
    .filter((w) => w.length > 1)

export const hasAllWords = (text: string, wanted: string[]) => {
  const t = text.toLowerCase()
  return wanted.every((w) => t.includes(w))
}

export type SearchResult = {
  // matching entries, in the order given
  noteIds: string[]
  highlightIds: Set<string>
  byMeaning: boolean
  loading?: boolean
}

export function searchByWords(
  query: string,
  notes: {
    id: string
    title: string
    content: string
    quotes: { id: string; quote: string }[]
  }[],
): SearchResult {
  const wanted = searchWords(query)
  const highlightIds = new Set<string>()
  const noteIds: string[] = []
  for (const n of notes) {
    const own = n.quotes.filter((q) => hasAllWords(q.quote, wanted))
    for (const q of own) highlightIds.add(q.id)
    if (own.length || hasAllWords(`${n.title}\n${n.content}`, wanted))
      noteIds.push(n.id)
  }
  return { noteIds, highlightIds, byMeaning: false }
}
