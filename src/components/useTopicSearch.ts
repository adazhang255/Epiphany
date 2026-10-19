"use client"

import { useEffect, useState } from "react"
import { PUBLIC_SITE } from "@/lib/site-mode"
import { searchByWords, type SearchResult } from "@/features/search/words"

// A topic search for a page that filters in the browser. Locally it asks the
// server (words and meaning, via the local model); the public site has no
// server or model, so it matches words in the entries it was given.
export function useTopicSearch(
  query: string | undefined,
  notes: Parameters<typeof searchByWords>[1],
): SearchResult | null {
  const [found, setFound] = useState<(SearchResult & { q: string }) | null>(
    null,
  )
  useEffect(() => {
    if (!query || PUBLIC_SITE) return
    let alive = true
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive)
          setFound({
            q: query,
            noteIds: d.noteIds,
            highlightIds: new Set(d.highlightIds),
            byMeaning: d.byMeaning,
          })
      })
      .catch(() => {
        if (alive) setFound({ q: query, ...searchByWords(query, notes) })
      })
    return () => {
      alive = false
    }
  }, [query, notes])

  if (!query) return null
  if (PUBLIC_SITE) return searchByWords(query, notes)
  return found?.q === query
    ? found
    : { noteIds: [], highlightIds: new Set(), byMeaning: true, loading: true }
}

// Today's date, once the page is in the browser (null while it's being
// built, so a page built once still shows the visitor's own today).
export function useToday() {
  const [today, setToday] = useState<Date | null>(null)
  useEffect(() => {
    const id = requestAnimationFrame(() => setToday(new Date()))
    return () => cancelAnimationFrame(id)
  }, [])
  return today
}
