import { dayKey } from "@/features/notes/lib/time"

export type ThreadQuote = {
  id: string
  quote: string
  tags: string[]
  noteId: string
  noteTitle: string
  date: Date
  embedding: number[]
  // what kind of passage: a highlight's type, or "Question" for a question
  // found in an entry
  kind?: string
  // where it opens (defaults to the highlight in its entry)
  href?: string
}

export type Thread = {
  id: string
  label: string | null
  members: ThreadQuote[] // chronological, one per day
}

const MAX_MEMBERS = 8

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

// Which pairs of highlights are alike (cosine similarity of their
// embeddings at least `floor`), with how alike. Worked out once and shared by
// every match level: each per-highlight step (its day, its words, its
// embedding's length) is done once, not for every pair.
export type Similar = { i: number; j: number; sim: number }[]

export function similarPairs(quotes: ThreadQuote[], floor: number): Similar {
  const n = quotes.length
  const days = quotes.map((q) => dayKey(q.date))
  const words = quotes.map((q) => normalize(q.quote))
  // embeddings scaled to length 1, so similarity is a plain dot product
  const dims = quotes[0]?.embedding.length ?? 0
  const unit = quotes.map((q) => {
    const v = new Float64Array(dims)
    let len = 0
    for (let k = 0; k < dims; k++) len += (q.embedding[k] ?? 0) ** 2
    len = Math.sqrt(len)
    if (len && q.embedding.length === dims)
      for (let k = 0; k < dims; k++) v[k] = q.embedding[k] / len
    return v
  })
  const pairs: Similar = []
  for (let i = 0; i < n; i++) {
    const a = unit[i]
    for (let j = i + 1; j < n; j++) {
      // same-day echoes (or copies) aren't evolution
      if (days[i] === days[j]) continue
      // a pasted copy repeats a thought; it doesn't develop it
      if (words[i] === words[j]) continue
      const b = unit[j]
      let sim = 0
      for (let k = 0; k < dims; k++) sim += a[k] * b[k]
      if (sim >= floor) pairs.push({ i, j, sim })
    }
  }
  return pairs
}

// Group highlights that say similar things on different days into threads.
// Highlights are linked when their embeddings' cosine similarity reaches
// `threshold`; linked groups (connected components) become threads. Pass
// `pairs` from similarPairs (at or below this threshold) to reuse them.
export function buildThreads(
  quotes: ThreadQuote[],
  threshold: number,
  pairs: Similar = similarPairs(quotes, threshold),
): Thread[] {
  const parent = quotes.map((_, i) => i)
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]))
  const sims = new Map<string, number>()
  for (const { i, j, sim } of pairs) {
    if (sim < threshold) continue
    sims.set(`${i}:${j}`, sim)
    parent[find(i)] = find(j)
  }

  const groups = new Map<number, number[]>()
  quotes.forEach((_, i) => {
    const root = find(i)
    groups.set(root, [...(groups.get(root) ?? []), i])
  })

  const threads: Thread[] = []
  for (const members of groups.values()) {
    if (members.length < 2) continue

    // one representative per day: the one most connected to the rest
    const strength = (i: number) =>
      members.reduce(
        (sum, j) => sum + (sims.get(i < j ? `${i}:${j}` : `${j}:${i}`) ?? 0),
        0,
      )
    const byDay = new Map<string, number>()
    for (const i of members) {
      const day = dayKey(quotes[i].date)
      const current = byDay.get(day)
      if (current === undefined || strength(i) > strength(current))
        byDay.set(day, i)
    }
    if (byDay.size < 2) continue

    let chosen = [...byDay.values()]
      .map((i) => quotes[i])
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    if (chosen.length > MAX_MEMBERS) {
      // keep the first and last, sample evenly between
      const step = (chosen.length - 1) / (MAX_MEMBERS - 1)
      chosen = Array.from(
        { length: MAX_MEMBERS },
        (_, k) => chosen[Math.round(k * step)],
      )
    }

    // name the thread after the tag its highlights share most
    const tagCounts = new Map<string, number>()
    for (const i of members) {
      for (const tag of quotes[i].tags)
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
    const [label, count] = [...tagCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0] ?? [null, 0]

    threads.push({
      id: chosen[0].id,
      label: count >= 2 ? label : null,
      members: chosen,
    })
  }

  // most recently continued first
  return threads.sort(
    (a, b) =>
      b.members.at(-1)!.date.getTime() - a.members.at(-1)!.date.getTime(),
  )
}
