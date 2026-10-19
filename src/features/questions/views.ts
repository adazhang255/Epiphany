import { prisma } from "@/lib/prisma"
import { syncQuestions } from "@/features/questions/sync"
import type { QuestionView } from "@/components/QuestionCard"

// Every question and wondering from every entry (including ones marked "not
// a question"), with the answers linked to each, for the Question filter.
export async function loadQuestionViews(): Promise<QuestionView[]> {
  // every "?" and every "perhaps / maybe / I wonder" in every entry
  await syncQuestions()

  const questions = await prisma.question.findMany({
    include: {
      note: { select: { id: true, title: true, date: true } },
      replies: {
        select: {
          id: true,
          quote: true,
          category: true,
          note: { select: { id: true, title: true, date: true } },
        },
        orderBy: { note: { date: "asc" } },
      },
    },
  })

  return questions
    .sort((a, b) => b.note.date.getTime() - a.note.date.getTime())
    .map((q) => ({
      id: q.id,
      quote: q.text,
      kind: q.kind.replace(/^not:/, "") as "question" | "wondering",
      hidden: q.kind.startsWith("not:"),
      noteId: q.note.id,
      noteTitle: q.note.title,
      date: q.note.date.toISOString(),
      replies: q.replies.map((r) => ({
        id: r.id,
        quote: r.quote,
        category: r.category,
        noteId: r.note.id,
        noteTitle: r.note.title,
        date: r.note.date.toISOString(),
      })),
    }))
}
