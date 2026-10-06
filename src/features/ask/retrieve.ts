import { prisma } from "@/lib/prisma"
import { cosine, parseEmbedding } from "@/features/notes/lib/similarity"
import { embed } from "@/features/notes/services/embeddings.service"
import { entryCategories } from "@/features/notes/lib/topics"

export type Source = {
  n: number // citation number, [1], [2], …
  id: string
  title: string
  date: string // ISO
  category: string
  content: string
  score: number
}

const MAX_SOURCES = 6
// Below this an entry is too unrelated to cite (nomic-embed-text scores
// unrelated passages around 0.55-0.65).
const MIN_SCORE = 0.6
const SOURCE_CHARS = 1500

// Find the entries most related to the question. An entry scores by its own
// embedding or its best-matching highlight, whichever is closer.
export async function findSources(question: string) {
  const [queryVector] = await embed([question])
  const notes = await prisma.note.findMany({
    select: {
      id: true,
      title: true,
      date: true,
      content: true,
      ownCategory: true,
      embedding: true,
      quotes: { select: { embedding: true, category: true } },
    },
  })

  const embedded = notes.filter(
    (n) => n.embedding || n.quotes.some((q) => q.embedding),
  )
  const scored = embedded
    .map((note) => {
      const vectors = [note.embedding, ...note.quotes.map((q) => q.embedding)]
        .map(parseEmbedding)
        .filter((v): v is number[] => v !== null)
      return {
        note,
        score: Math.max(...vectors.map((v) => cosine(queryVector, v))),
      }
    })
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SOURCES)
    // present them in time order so the model can see change over time
    .sort((a, b) => a.note.date.getTime() - b.note.date.getTime())

  const sources: Source[] = scored.map(({ note, score }, i) => ({
    n: i + 1,
    id: note.id,
    title: note.title,
    date: note.date.toISOString(),
    category: entryCategories(
      note.ownCategory,
      note.quotes.map((q) => q.category),
    ).join(", "),
    content: note.content.slice(0, SOURCE_CHARS),
    score,
  }))

  return { sources, unembedded: notes.length - embedded.length }
}
