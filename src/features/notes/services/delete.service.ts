import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { offerUndo } from "@/features/undo/undo"

// Deleted entries are written here first, so any delete can still be
// recovered by hand. (Runtime only, so the bundler shouldn't trace it.)
const BACKUP_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.BACKUP_DIR ?? "backups",
)

type Note = Awaited<ReturnType<typeof loadForBackup>>[number]

export function loadForBackup(ids: string[]) {
  return prisma.note.findMany({
    where: { id: { in: ids } },
    include: { quotes: true, questions: true },
  })
}

// Back up the entries (with their highlights and questions) to a JSON file,
// then delete them. Returns the backup's path, relative to the project, and
// a token to undo it (see features/undo): `alsoUndo` puts back anything else
// the caller changed along with it.
export async function deleteWithBackup(
  notes: Note[],
  label = "deleted",
  undoLabel = notes.length === 1
    ? "Entry deleted"
    : `${notes.length} entries deleted`,
  alsoUndo?: () => Promise<unknown>,
) {
  const ids = notes.map((n) => n.id)
  // links from other entries that deleting these clears, to put back on undo
  const questionIds = notes.flatMap((n) => n.questions.map((q) => q.id))
  const [answeredQuotes, answeredQuestions, replies] = await Promise.all([
    prisma.quote.findMany({
      where: { answerNoteId: { in: ids }, noteId: { notIn: ids } },
      select: { id: true, answerNoteId: true },
    }),
    prisma.question.findMany({
      where: { answerNoteId: { in: ids }, noteId: { notIn: ids } },
      select: { id: true, answerNoteId: true },
    }),
    prisma.quote.findMany({
      where: { replyToId: { in: questionIds }, noteId: { notIn: ids } },
      select: { id: true, replyToId: true },
    }),
  ])
  await mkdir(BACKUP_DIR, { recursive: true })
  const backup = path.join(
    BACKUP_DIR,
    `${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  )
  await writeFile(backup, JSON.stringify(notes, null, 2))

  await prisma.$transaction([
    // highlights belong to their note and go with it (questions cascade)
    prisma.quote.deleteMany({ where: { noteId: { in: ids } } }),
    prisma.note.deleteMany({ where: { id: { in: ids } } }),
  ])
  console.info(`[delete] ${ids.length} entries; backup at ${backup}`)
  const undo = offerUndo(undoLabel, async () => {
    await restoreEntries(notes)
    await prisma.$transaction([
      ...answeredQuotes.map((q) =>
        prisma.quote.updateMany({
          where: { id: q.id },
          data: { answerNoteId: q.answerNoteId },
        }),
      ),
      ...answeredQuestions.map((q) =>
        prisma.question.updateMany({
          where: { id: q.id },
          data: { answerNoteId: q.answerNoteId },
        }),
      ),
      ...replies.map((q) =>
        prisma.quote.updateMany({
          where: { id: q.id },
          data: { replyToId: q.replyToId },
        }),
      ),
    ])
    await alsoUndo?.()
  })
  return { backup: path.relative(process.cwd(), backup), undo }
}

// Put deleted entries back as they were (same ids), with their highlights
// and questions. Links between them come back too; ones from other entries
// are the caller's to restore.
export async function restoreEntries(notes: Note[]) {
  await prisma.$transaction(async (tx) => {
    // (each entry's own fields; its highlights and questions follow)
    const own = (n: Note) =>
      Object.fromEntries(
        Object.entries(n).filter(([k]) => k !== "quotes" && k !== "questions"),
      ) as Omit<Note, "quotes" | "questions">
    for (const n of notes) await tx.note.create({ data: own(n) })
    const allQuestions = notes.flatMap((n) => n.questions)
    const allQuotes = notes.flatMap((n) => n.quotes)
    // questions first: highlights can be answers to them
    if (allQuestions.length)
      await tx.question.createMany({ data: allQuestions })
    if (allQuotes.length) await tx.quote.createMany({ data: allQuotes })
  })
}
