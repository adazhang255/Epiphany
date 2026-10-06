import { prisma } from "@/lib/prisma"
import { searchTopic } from "@/features/search/topic"
import { dayKey } from "@/features/notes/lib/time"
import {
  cleanCategoryName,
  entryCategories,
  highlightType,
  isBuiltinCategory,
  parsePurposes,
} from "@/features/notes/lib/topics"

export async function createNote(data: {
  title: string
  content: string
  category: string
  tags: string
  date: Date
}) {
  return prisma.note.create({
    data,
  })
}

export async function getNoteById(id: string) {
  return prisma.note.findUnique({
    where: { id },
  })
}

// Every note with its highlights, newest first. Drives the timeline.
export async function getTimeline() {
  return prisma.note.findMany({
    include: {
      quotes: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  })
}

// A note plus the thoughts written just before and after it.
export async function getNoteWithNeighbors(id: string) {
  const note = await prisma.note.findUnique({
    where: { id },
    include: {
      quotes: {
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!note) {
    return null
  }

  const [earlier, later] = await Promise.all([
    prisma.note.findFirst({
      where: {
        OR: [
          { date: { lt: note.date } },
          { date: note.date, createdAt: { lt: note.createdAt } },
        ],
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, date: true },
    }),
    prisma.note.findFirst({
      where: {
        OR: [
          { date: { gt: note.date } },
          { date: note.date, createdAt: { gt: note.createdAt } },
        ],
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, date: true },
    }),
  ])

  return { note, earlier, later }
}

// Store an LLM analysis. Highlights are only replaced when the model found
// some, so a bad run never wipes existing ones. A question that survives a
// regeneration word-for-word keeps its answered state.
export async function saveAnalysis(
  noteId: string,
  analysis: {
    sentiment: number | null
    // embedding of the whole entry, for Ask your journal
    noteEmbedding?: number[]
    topics: string[]
    tags: string[]
    highlights: {
      quote: string
      category: string
      tags: string[]
      embedding?: number[]
    }[]
  },
) {
  const updateNote = prisma.note.update({
    where: { id: noteId },
    data: {
      topics: analysis.topics.join(","),
      // tags aren't produced any more; keep the ones already stored
      ...(analysis.tags.length ? { autoTags: analysis.tags.join(",") } : {}),
      // tone is filled in by the background pass; never wipe one already set
      ...(analysis.sentiment !== null ? { sentiment: analysis.sentiment } : {}),
      ...(analysis.noteEmbedding
        ? { embedding: JSON.stringify(analysis.noteEmbedding) }
        : {}),
    },
  })
  if (analysis.highlights.length === 0) {
    return prisma.$transaction([updateNote])
  }

  const previous = await prisma.quote.findMany({
    where: { noteId, answeredAt: { not: null } },
    select: { quote: true, answeredAt: true, answerNoteId: true },
  })
  const answered = new Map(previous.map((q) => [q.quote, q]))

  // Highlights you marked yourself, and answers linked to questions, stay;
  // AI ones that overlap them are dropped.
  const mine = await prisma.quote.findMany({
    where: { noteId, OR: [{ manual: true }, { replyToId: { not: null } }] },
    select: { quote: true },
  })
  const overlapsMine = (text: string) =>
    mine.some((m) => m.quote.includes(text) || text.includes(m.quote))

  return prisma.$transaction([
    updateNote,
    prisma.quote.deleteMany({
      where: { noteId, manual: false, replyToId: null },
    }),
    prisma.quote.createMany({
      data: analysis.highlights
        .filter((item) => !overlapsMine(item.quote))
        .map((item) => ({
          noteId,
          quote: item.quote,
          category: item.category,
          tags: item.tags.join(","),
          embedding: item.embedding ? JSON.stringify(item.embedding) : null,
          answeredAt: answered.get(item.quote)?.answeredAt ?? null,
          answerNoteId: answered.get(item.quote)?.answerNoteId ?? null,
        })),
    }),
  ])
}

// Highlights still waiting for an embedding (older ones, or Ollama was down).
export async function getUnembeddedQuotes() {
  return prisma.quote.findMany({
    where: { embedding: null },
    select: { id: true, quote: true },
  })
}

// Entries without a whole-entry embedding.
export async function getUnembeddedNotes() {
  return prisma.note.findMany({
    where: { embedding: null },
    select: { id: true, title: true, content: true },
  })
}

export async function setNoteEmbeddings(
  rows: { id: string; embedding: number[] }[],
) {
  return prisma.$transaction(
    rows.map((row) =>
      prisma.note.update({
        where: { id: row.id },
        data: { embedding: JSON.stringify(row.embedding) },
      }),
    ),
  )
}

export async function setEmbeddings(
  rows: { id: string; embedding: number[] }[],
) {
  return prisma.$transaction(
    rows.map((row) =>
      prisma.quote.update({
        where: { id: row.id },
        data: { embedding: JSON.stringify(row.embedding) },
      }),
    ),
  )
}

// Every highlight with its note's date and title; for threads and questions.
export async function getQuotesWithNotes() {
  return prisma.quote.findMany({
    include: {
      note: { select: { id: true, title: true, date: true, createdAt: true } },
      answerNote: { select: { id: true, title: true, date: true } },
    },
  })
}

export async function getSavedCharts() {
  return prisma.savedChart.findMany({ orderBy: { createdAt: "desc" } })
}

export async function createSavedChart(title: string, spec: string) {
  return prisma.savedChart.create({ data: { title, spec } })
}

export async function deleteSavedChart(id: string) {
  return prisma.savedChart.delete({ where: { id } })
}

// Entries saved more than once: identical text on the same date (titles may
// differ). In each group the copy with the most highlights is kept, then the
// oldest; the rest are the duplicates.
export async function findDuplicateGroups() {
  const notes = await prisma.note.findMany({
    select: {
      id: true,
      title: true,
      content: true,
      date: true,
      createdAt: true,
      published: true,
      topics: true,
      tags: true,
      autoTags: true,
      quotes: {
        select: { id: true, quote: true },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { quotes: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const groups = new Map<string, typeof notes>()
  for (const note of notes) {
    const key = `${note.date.toISOString()}\u0000${note.content.trim()}`
    groups.set(key, [...(groups.get(key) ?? []), note])
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const [keep, ...remove] = [...group].sort(
        (a, b) =>
          b._count.quotes - a._count.quotes ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      )
      return { keep, remove }
    })
}

// Delete the duplicates. `keepIds` overrides which copy survives in a group
// (any id from that group); otherwise the default pick is kept. The kept copy
// stays public if any copy was public.
export async function removeDuplicates(keepIds: string[] = []) {
  const groups = (await findDuplicateGroups()).map((g) => {
    const members = [g.keep, ...g.remove]
    const chosen = members.find((n) => keepIds.includes(n.id))
    return chosen
      ? { keep: chosen, remove: members.filter((n) => n.id !== chosen.id) }
      : g
  })
  const removeIds = groups.flatMap((g) => g.remove.map((n) => n.id))
  const publish = groups
    .filter((g) => !g.keep.published && g.remove.some((n) => n.published))
    .map((g) => g.keep.id)

  await prisma.$transaction([
    prisma.note.updateMany({
      where: { id: { in: publish } },
      data: { published: true },
    }),
    // highlights belong to their note and go with it
    prisma.quote.deleteMany({ where: { noteId: { in: removeIds } } }),
    prisma.note.deleteMany({ where: { id: { in: removeIds } } }),
  ])
  return removeIds.length
}

export async function setPurposes(noteId: string, purposes: string[]) {
  return prisma.note.update({
    where: { id: noteId },
    data: { category: parsePurposes(purposes.join(",")).join(",") },
  })
}

export type NotebookNote = {
  id: string
  title: string
  content: string
  date: string // ISO
  category: string
  tags: string
  autoTags: string
  createdAt: string // ISO: when it was saved, for its time of day
  purposes: string[] // its category, from its highlights
  // its highlights, to tint in the text
  highlights: { id: string; quote: string; category: string }[]
}

export type NotebookFilter = "all" | "uncategorized"

// Full entries for the Notebook page, newest first, a few at a time.
// `cursor` is the last entry already shown. "uncategorized" keeps only
// entries whose highlights give no category (usually: none worth keeping).
// Every entry, newest first, with what the Notebook filters by.
async function loadNotebook() {
  const all = await prisma.note.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      content: true,
      date: true,
      category: true,
      tags: true,
      autoTags: true,
      createdAt: true,
      ownCategory: true,
      quotes: {
        select: { id: true, quote: true, category: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  // newest day first; within a day, the one written latest first (the time
  // shown at the foot of each page), whatever time the date itself carries
  const day = new Map(all.map((n) => [n.id, dayKey(n.date)]))
  all.sort(
    (a, b) =>
      day.get(b.id)!.localeCompare(day.get(a.id)!) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  )
  return all.map(({ quotes, ...n }) => ({
    ...n,
    date: n.date.toISOString(),
    createdAt: n.createdAt.toISOString(),
    purposes: entryCategories(
      n.ownCategory,
      quotes.map((q) => q.category),
    ),
    highlights: quotes,
  }))
}

export type NotebookOptions = {
  take?: number
  filter?: NotebookFilter
  category?: string // only entries in this category (any case)
  q?: string // a topic search: matching entries, most relevant first
}

export async function getNotebookPage(
  cursor?: string,
  { take = 6, filter = "all", category, q }: NotebookOptions = {},
) {
  const wantCategory = category?.trim().toLowerCase()
  let matching = (await loadNotebook()).filter(
    (n) =>
      (filter !== "uncategorized" || n.purposes.length === 0) &&
      (!wantCategory ||
        n.purposes.some((c) => c.toLowerCase() === wantCategory)),
  )
  let byMeaning = true
  if (q?.trim()) {
    const found = await searchTopic(q)
    byMeaning = found.byMeaning
    const rank = new Map(found.entries.map((e, i) => [e.noteId, i]))
    matching = matching
      .filter((n) => rank.has(n.id))
      .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  }
  const start = cursor ? matching.findIndex((n) => n.id === cursor) + 1 : 0
  const notes: NotebookNote[] = matching.slice(start, start + take)
  return {
    notes,
    nextCursor:
      notes.length > 0 && start + take < matching.length
        ? notes.at(-1)!.id
        : null,
    count: matching.length,
    byMeaning,
  }
}

// What the Notebook's filters offer: how many entries in all, without a
// category, and in each category.
export async function getNotebookFacets() {
  const notes = await loadNotebook()
  const categories = new Map<string, number>()
  for (const n of notes)
    for (const c of n.purposes) categories.set(c, (categories.get(c) ?? 0) + 1)
  return {
    total: notes.length,
    uncategorized: notes.filter((n) => n.purposes.length === 0).length,
    categories: [...categories]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count })),
  }
}

// Category names you've made yourself (on highlights or whole entries), for
// pickers to offer alongside the built-in types.
export async function getCustomCategories() {
  const [quotes, notes] = await Promise.all([
    prisma.quote.findMany({
      select: { category: true },
      distinct: ["category"],
    }),
    prisma.note.findMany({
      where: { ownCategory: { not: "" } },
      select: { ownCategory: true },
    }),
  ])
  const names = [
    ...quotes.map((q) => highlightType(q.category)),
    ...notes.flatMap((n) => n.ownCategory.split(",")),
  ]
    .map(cleanCategoryName)
    .filter((c): c is string => c !== null && !isBuiltinCategory(c))
  return [...new Set(names)].sort()
}
