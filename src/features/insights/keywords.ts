import { STOP } from "@/features/insights/yearReview"

// Keywords in charts: how often a word or phrase appears in an entry,
// counted from the text itself (whole words, any case, with its plural and
// -ed / -ing forms: "walk" counts "walks", "walked", "walking").

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

function pattern(keyword: string) {
  const words = keyword.trim().split(/\s+/).map(escape).join("\\s+")
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${words}(?:s|es|ed|d|ing|'s|’s)?(?![\\p{L}\\p{N}])`,
    "giu",
  )
}

const cache = new Map<string, RegExp>()
export function countMentions(text: string, keyword: string) {
  let re = cache.get(keyword)
  if (!re) cache.set(keyword, (re = pattern(keyword)))
  re.lastIndex = 0
  return text.match(re)?.length ?? 0
}

// The words written most often (not everyday ones), for a keyword chart
// asked for without naming any.
export function topWords(texts: string[], count = 6) {
  const freq = new Map<string, number>()
  for (const text of texts)
    for (const w of text.toLowerCase().match(/[\p{L}'’]+/gu) ?? []) {
      const word = w.replace(/’/g, "'").replace(/^'+|'+$/g, "")
      if (word.length < 4 || STOP.has(word)) continue
      freq.set(word, (freq.get(word) ?? 0) + 1)
    }
  return [...freq]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([w]) => w)
}

// The words that say most about this journal: written again and again, but
// only in some entries (so "sam" during the months Sam was around, not
// "really" everywhere). Scored like TF-IDF: times written × how few entries
// they're in. At least 3 times, in at least 2 entries.
export function keyWords(texts: string[], count = 6) {
  const total = new Map<string, number>()
  const inEntries = new Map<string, number>()
  for (const text of texts) {
    const seen = new Set<string>()
    for (const w of text.toLowerCase().match(/[\p{L}'’]+/gu) ?? []) {
      const word = w
        .replace(/’/g, "'")
        .replace(/^'+|'+$/g, "")
        .replace(/'s$/, "")
      if (word.length < 4 || STOP.has(word)) continue
      total.set(word, (total.get(word) ?? 0) + 1)
      seen.add(word)
    }
    for (const word of seen) inEntries.set(word, (inEntries.get(word) ?? 0) + 1)
  }
  const n = texts.length
  return [...total]
    .filter(([w, c]) => c >= 3 && (inEntries.get(w) ?? 0) >= 2)
    .map(([w, c]) => ({
      w,
      score: c * Math.log((n + 1) / ((inEntries.get(w) ?? 0) + 1)),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.w.localeCompare(b.w))
    .slice(0, count)
    .map((x) => x.w)
}

// up to 8 clean, distinct keywords from a list or "a, b, c"
export function cleanKeywords(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const k = String(item ?? "")
      .replace(/["“”]/g, "")
      .trim()
      .toLowerCase()
      .slice(0, 40)
    if (k && !seen.has(k)) {
      seen.add(k)
      out.push(k)
    }
  }
  return out.slice(0, 8)
}
