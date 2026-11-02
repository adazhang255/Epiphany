import { prisma } from "@/lib/prisma"
import { parseEmbedding } from "@/features/notes/lib/similarity"
import {
  buildThreads,
  similarPairs,
  type Thread,
  type ThreadQuote,
} from "@/features/notes/lib/threads"
import { highlightType } from "@/features/notes/lib/topics"
import { knownTitle } from "@/features/threads/titles"
import { parseThread } from "@/features/threads/field"

// Every thread on the Threads page, from three sources:
//   - "pinned": passages you put in a thread (their `thread` is that id)
//   - "auto": everything else, grouped by similarity (`thread` empty)
//   - "qa": a question with the answers later entries gave it
// Passages you took out of threads (`thread` = "none") are left out.

import {
  MATCH,
  type MatchLevel,
  type ThreadView,
} from "@/features/threads/match"
export { MATCH, type MatchLevel, type ThreadView }

export async function getThreads(level: MatchLevel = "related") {
  const { byLevel, missing } = await getThreadsAt([level])
  return { threads: byLevel[level], missing }
}

// The threads at several match levels at once: everything is loaded, and
// every pair compared, once (that comparison is most of the work).
export async function getThreadsAt<L extends MatchLevel>(levels: L[]) {
  const [rows, questions] = await Promise.all([
    prisma.quote.findMany({
      include: { note: { select: { id: true, title: true, date: true } } },
    }),
    prisma.question.findMany({
      where: { NOT: { kind: { startsWith: "not:" } } },
      include: {
        note: { select: { id: true, title: true, date: true } },
        replies: {
          include: { note: { select: { id: true, title: true, date: true } } },
        },
      },
    }),
  ])

  const fromQuote = (q: (typeof rows)[number]): ThreadQuote => ({
    id: q.id,
    quote: q.quote,
    tags: [],
    noteId: q.note.id,
    noteTitle: q.note.title,
    date: q.note.date,
    embedding: parseEmbedding(q.embedding) ?? [],
    kind: highlightType(q.category),
  })
  const fromQuestion = (q: (typeof questions)[number]): ThreadQuote => ({
    id: `q-${q.id}`,
    quote: q.text,
    tags: [],
    noteId: q.note.id,
    noteTitle: q.note.title,
    date: q.note.date,
    embedding: parseEmbedding(q.embedding) ?? [],
    kind: "Question",
    href: `/notes/${q.note.id}`,
  })
  // a question already highlighted takes part as that highlight
  const highlighted = (q: (typeof questions)[number]) =>
    rows.some((r) => r.noteId === q.noteId && r.quote.includes(q.text))

  // threads you arranged (and maybe named)
  const pinned = new Map<string, ThreadQuote[]>()
  const names = new Map<string, string>()
  const pin = (field: string | null, member: ThreadQuote) => {
    const t = parseThread(field)
    if (t.kind !== "pinned") return
    pinned.set(t.id, [...(pinned.get(t.id) ?? []), member])
    if (t.name) names.set(t.id, t.name)
  }
  for (const r of rows) pin(r.thread, fromQuote(r))
  for (const q of questions) if (!highlighted(q)) pin(q.thread, fromQuestion(q))

  // everything else, by similarity
  const free = [
    ...rows.filter((r) => !r.thread).map(fromQuote),
    ...questions.filter((q) => !q.thread && !highlighted(q)).map(fromQuestion),
  ].filter((m) => m.embedding.length > 0)
  const floor = Math.min(...levels.map((l) => MATCH[l].threshold))
  const pairs = similarPairs(free, floor)

  const ids = (t: Thread) =>
    t.members.map((m) => m.id).filter((id) => !id.startsWith("q-"))
  // the same at every level: threads you arranged, and questions' answers
  const arranged: ThreadView[] = [
    ...[...pinned]
      // (one you named shows from its first passage, so a thread you just
      // started is there to add to)
      .filter(([id, members]) => members.length >= 2 || names.has(id))
      .map(([id, members]) => {
        const t: Thread = {
          id,
          label: null,
          members: members.sort((a, b) => a.date.getTime() - b.date.getTime()),
        }
        const name = names.get(id)
        return {
          ...t,
          kind: "pinned" as const,
          title: name ?? knownTitle(ids(t)),
          named: Boolean(name),
        }
      }),
    ...questions
      .filter((q) => q.replies.length > 0)
      .map((q) => ({
        id: `qa-${q.id}`,
        label: null,
        kind: "qa" as const,
        title: q.text,
        named: false,
        questionId: q.id,
        members: [
          fromQuestion(q),
          ...q.replies
            .map((r) =>
              fromQuote({ ...r, note: r.note } as (typeof rows)[number]),
            )
            .sort((a, b) => a.date.getTime() - b.date.getTime()),
        ],
      })),
  ]
  const byLevel = {} as Record<L, ThreadView[]>
  for (const level of levels) {
    const auto = buildThreads(free, MATCH[level].threshold, pairs)
    const threads: ThreadView[] = [
      ...arranged,
      ...auto.map((t) => ({
        ...t,
        kind: "auto" as const,
        title: knownTitle(ids(t)),
        named: false,
      })),
    ]
    // most recently continued first
    threads.sort(
      (a, b) =>
        b.members.at(-1)!.date.getTime() - a.members.at(-1)!.date.getTime(),
    )
    byLevel[level] = threads
  }
  return { byLevel, missing: rows.filter((q) => !q.embedding).length }
}
