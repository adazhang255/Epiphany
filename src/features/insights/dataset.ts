import { prisma } from "@/lib/prisma"
import {
  highlightType,
  entryCategories,
  splitList,
} from "@/features/notes/lib/topics"
import type { InsightNote } from "@/features/insights/compute"

// Everything the charts need, sent to the browser (the text too, so keyword
// charts can count words there).
export async function getInsightsDataset(): Promise<InsightNote[]> {
  const notes = await prisma.note.findMany({
    select: {
      id: true,
      title: true,
      date: true,
      content: true,
      sentiment: true,
      ownCategory: true,
      topics: true,
      tags: true,
      autoTags: true,
      quotes: { select: { category: true, tags: true } },
    },
    orderBy: { date: "asc" },
  })

  return notes.map((note) => ({
    id: note.id,
    title: note.title,
    date: note.date.toISOString(),
    words: note.content.split(/\s+/).filter(Boolean).length,
    purposes: entryCategories(
      note.ownCategory,
      note.quotes.map((q) => q.category),
    ),
    sentiment: note.sentiment,
    topics: splitList(note.topics),
    quotes: note.quotes.map((q) => ({
      category: highlightType(q.category),
    })),
    // for keyword charts (counted in the browser, like everything else)
    text: note.content,
  }))
}
