import { prisma } from "@/lib/prisma"
import { cosine, parseEmbedding } from "@/features/notes/lib/similarity"
import { embed } from "@/features/notes/services/embeddings.service"

// Topic search: find entries (and highlights) about something, two ways.
//   - by words: every word you typed appears in it (any case), ranked first
//   - by meaning: the local embedding model rates it close to what you
//     typed, even with none of the same words ("money worries" finds
//     "eleven dollars on good bread")
// If the embedding model isn't running, it searches by words only.

// How close in meaning counts as "about it". Unrelated passages score around
// 0.55-0.68 with nomic-embed-text, so a meaning match must pass FLOOR and be
// near the best match for this search (within NEAR_BEST); when some entries
// contain the words themselves, meaning-only ones must pass WITH_WORDS too.
const FLOOR = 0.68
const NEAR_BEST = 0.06
const WITH_WORDS = 0.72

export type TopicMatch = {
  noteId: string
  how: "words" | "meaning"
  score: number // higher is closer
}

export type TopicResults = {
  // matching entries, best first
  entries: TopicMatch[]
  // highlights that match by themselves
  highlightIds: Set<string>
  // false when the embedding model couldn't be reached
  byMeaning: boolean
}

// the search's own embedding, kept for this server's lifetime
const store = globalThis as unknown as {
  __topicVectors?: Map<string, number[]>
}
const vectors: Map<string, number[]> = (store.__topicVectors ??= new Map())

const words = (q: string) =>
  q
    .toLowerCase()
    .split(/[^\p{L}\p{N}'’]+/u)
    .filter((w) => w.length > 1)

const hasAll = (text: string, wanted: string[]) => {
  const t = text.toLowerCase()
  return wanted.every((w) => t.includes(w))
}

export async function searchTopic(query: string): Promise<TopicResults> {
  const q = query.trim()
  const wanted = words(q)
  if (!q || wanted.length === 0) {
    return { entries: [], highlightIds: new Set(), byMeaning: true }
  }

  let qv = vectors.get(q.toLowerCase())
  if (!qv) {
    const [v] = await embed([q]).catch(() => [] as number[][])
    if (v) {
      qv = v
      vectors.set(q.toLowerCase(), v)
    }
  }

  const notes = await prisma.note.findMany({
    select: {
      id: true,
      title: true,
      content: true,
      date: true,
      embedding: true,
      quotes: { select: { id: true, quote: true, embedding: true } },
    },
  })

  // first pass: every entry's and highlight's closeness, and word matches
  const scored = notes.map((n) => {
    const highlights = n.quotes.map((h) => {
      const v = qv ? parseEmbedding(h.embedding) : null
      return {
        id: h.id,
        sim: v ? cosine(qv!, v) : 0,
        words: hasAll(h.quote, wanted),
      }
    })
    const nv = qv ? parseEmbedding(n.embedding) : null
    const sim = Math.max(
      nv ? cosine(qv!, nv) : 0,
      ...highlights.map((h) => h.sim),
    )
    return {
      n,
      sim,
      words: hasAll(`${n.title}\n${n.content}`, wanted),
      highlights,
    }
  })
  const anyWords = scored.some((s) => s.words)
  const bestEntry = Math.max(0, ...scored.map((s) => s.sim))
  const bestHighlight = Math.max(
    0,
    ...scored.flatMap((s) => s.highlights.map((h) => h.sim)),
  )
  const cut = (best: number) =>
    Math.max(FLOOR, best - NEAR_BEST, anyWords ? WITH_WORDS : 0)
  const entryCut = cut(bestEntry)
  const highlightCut = cut(bestHighlight)

  const highlightIds = new Set<string>()
  const entries: (TopicMatch & { date: number })[] = []
  for (const s of scored) {
    for (const h of s.highlights)
      if (h.words || h.sim >= highlightCut) highlightIds.add(h.id)
    if (s.words)
      entries.push({
        noteId: s.n.id,
        how: "words",
        score: 2 + s.sim,
        date: s.n.date.getTime(),
      })
    else if (s.sim >= entryCut)
      entries.push({
        noteId: s.n.id,
        how: "meaning",
        score: s.sim,
        date: s.n.date.getTime(),
      })
  }

  entries.sort((a, b) => b.score - a.score || b.date - a.date)
  return {
    entries: entries.map(({ noteId, how, score }) => ({ noteId, how, score })),
    highlightIds,
    byMeaning: Boolean(qv),
  }
}
