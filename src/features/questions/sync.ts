import { prisma } from "@/lib/prisma"
import { extractQuestions } from "@/features/questions/extract"
import { embed } from "@/features/notes/services/embeddings.service"

// Bring the Question table in line with every entry's current text: add new
// questions, drop ones whose sentence was edited away (unless answered), and
// carry over answers recorded on older "Question" highlights.
export async function syncQuestions(noteIds?: string[]) {
  const notes = await prisma.note.findMany({
    where: noteIds ? { id: { in: noteIds } } : undefined,
    select: {
      id: true,
      content: true,
      questions: { select: { id: true, text: true, answeredAt: true } },
      quotes: {
        where: { answeredAt: { not: null } },
        select: { quote: true, answeredAt: true, answerNoteId: true },
      },
    },
  })

  for (const note of notes) {
    const found = extractQuestions(note.content)
    const existing = new Map(note.questions.map((q) => [q.text, q]))
    const keep = new Set(found.map((f) => f.text))

    const toCreate = found.filter((f) => !existing.has(f.text))
    const toDelete = note.questions.filter(
      (q) => !keep.has(q.text) && !q.answeredAt,
    )
    if (toCreate.length === 0 && toDelete.length === 0) continue

    await prisma.$transaction([
      prisma.question.deleteMany({
        where: { id: { in: toDelete.map((q) => q.id) } },
      }),
      prisma.question.createMany({
        data: toCreate.map((f) => {
          const legacy = note.quotes.find(
            (q) => q.quote.includes(f.text) || f.text.includes(q.quote),
          )
          return {
            noteId: note.id,
            text: f.text,
            kind: f.kind,
            answeredAt: legacy?.answeredAt ?? null,
            answerNoteId: legacy?.answerNoteId ?? null,
          }
        }),
      }),
    ])
  }

  // Embeddings let the page suggest which later entry answered a question.
  // A bonus: skipped quietly if Ollama isn't running.
  const missing = await prisma.question.findMany({
    where: { embedding: null },
    select: { id: true, text: true },
    take: 200,
  })
  if (missing.length > 0) {
    try {
      const vectors = await embed(missing.map((q) => q.text))
      await prisma.$transaction(
        missing.map((q, i) =>
          prisma.question.update({
            where: { id: q.id },
            data: { embedding: vectors[i] ? JSON.stringify(vectors[i]) : null },
          }),
        ),
      )
    } catch {
      // try again next time
    }
  }
}
