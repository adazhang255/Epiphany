import { prisma } from "@/lib/prisma"
import { findQuote } from "@/features/notes/lib/findQuote"
import { cosine, parseEmbedding } from "@/features/notes/lib/similarity"
import { embed } from "@/features/notes/services/embeddings.service"
import {
  chatJSON,
  pickTagModel,
} from "@/features/notes/services/ollama.service"
import { syncQuestions } from "@/features/questions/sync"

// "Find answers" on the Questions view, and only there: its own pass, run
// when you ask, apart from highlights and tone. Questions are never closed;
// an answer found in a later entry becomes an Insight highlight in that
// entry, linked to the question as a reply.
//
// For each question: the later entries that read most like it (by
// embedding) are shortlisted, then the local model checks each one for a
// passage that actually answers it. Same topic isn't enough.

// later entries checked per question, and how alike they must be to be checked
const CANDIDATES = 3
const MIN_SIMILARITY = 0.55
const MIN_CHARS = 15

const ANSWER_PROMPT = `You read a question someone wrote in their journal, and a later entry from the same journal.
Decide whether the later entry answers the question: a passage where the writer answers it, settles it, or reaches a conclusion about it. Only being about the same topic is NOT an answer.
If it answers it, copy that passage word for word from the entry (1 to 3 consecutive sentences) into "passage" and set "answers" to true.
If not, set "answers" to false and "passage" to "".`

const answerSchema = {
  type: "object",
  properties: {
    answers: { type: "boolean" },
    passage: { type: "string" },
  },
  required: ["answers", "passage"],
}

export type AnswersStatus = {
  running: boolean
  done: number // questions checked so far
  total: number
  found: number // replies added this run
  error?: string
  finishedAt?: number
}

const store = globalThis as unknown as { __findAnswers?: AnswersStatus }
const state: AnswersStatus = (store.__findAnswers ??= {
  running: false,
  done: 0,
  total: 0,
  found: 0,
})

export const answersStatus = (): AnswersStatus => ({ ...state })

// Start a run in the background; false if one is already going.
export function startFindingAnswers() {
  if (state.running) return false
  Object.assign(state, {
    running: true,
    done: 0,
    total: 0,
    found: 0,
    error: undefined,
    finishedAt: undefined,
  })
  void run()
    .catch((error) => {
      console.error("[answers]", error)
      state.error = (error as Error).message
    })
    .finally(() => {
      state.running = false
      state.finishedAt = Date.now()
    })
  return true
}

type NoteRef = { date: Date; createdAt: Date }
const isLater = (a: NoteRef, b: NoteRef) =>
  b.date > a.date ||
  (b.date.getTime() === a.date.getTime() && b.createdAt > a.createdAt)

async function run() {
  // every question, with an embedding to compare by
  await syncQuestions()
  const [questions, notes] = await Promise.all([
    prisma.question.findMany({
      // not the ones you marked as not really questions
      where: { NOT: { kind: { startsWith: "not:" } } },
      include: {
        note: { select: { date: true, createdAt: true } },
        replies: { select: { noteId: true } },
      },
    }),
    prisma.note.findMany({
      select: {
        id: true,
        date: true,
        createdAt: true,
        content: true,
        embedding: true,
        quotes: { select: { embedding: true } },
      },
    }),
  ])
  state.total = questions.length
  const model = await pickTagModel()

  for (const question of questions) {
    const own = parseEmbedding(question.embedding)
    const replied = new Set(question.replies.map((r) => r.noteId))
    if (own) {
      const shortlist = notes
        .filter((n) => n.id !== question.noteId && !replied.has(n.id))
        .filter((n) => isLater(question.note, n))
        .map((n) => {
          const vectors = [n.embedding, ...n.quotes.map((q) => q.embedding)]
            .map(parseEmbedding)
            .filter((v): v is number[] => v !== null)
          return {
            note: n,
            score: Math.max(0, ...vectors.map((v) => cosine(own, v))),
          }
        })
        .filter((c) => c.score >= MIN_SIMILARITY)
        .sort((a, b) => b.score - a.score)
        .slice(0, CANDIDATES)

      for (const { note } of shortlist) {
        const reply = await chatJSON<{ answers: boolean; passage: string }>(
          ANSWER_PROMPT,
          `Question: "${question.text}"\n\nLater entry:\n${note.content.slice(0, 6000)}`,
          answerSchema,
          { temperature: 0, model },
        )
        if (reply.answers !== true || typeof reply.passage !== "string")
          continue
        // only text that's really in the entry, word for word
        const range = findQuote(note.content, reply.passage)
        if (!range) continue
        const passage = note.content.slice(range.start, range.end).trim()
        if (passage.length < MIN_CHARS) continue
        if (await addReply(question.id, note.id, passage)) state.found++
      }
    }
    state.done++
  }
}

// Link the passage to the question as an Insight. If an AI highlight
// already covers it, that one is linked instead. Highlights you made (or
// said weren't an answer) are left alone.
async function addReply(questionId: string, noteId: string, passage: string) {
  const existing = await prisma.quote.findMany({
    where: { noteId },
    select: { id: true, quote: true, manual: true, replyToId: true },
  })
  const overlap = existing.find(
    (q) => q.quote.includes(passage) || passage.includes(q.quote),
  )
  if (overlap) {
    if (overlap.replyToId || overlap.manual) return false
    await prisma.quote.update({
      where: { id: overlap.id },
      data: { replyToId: questionId, category: "Insight" },
    })
    return true
  }
  const [vector] = await embed([passage]).catch(() => [] as number[][])
  await prisma.quote.create({
    data: {
      noteId,
      quote: passage,
      category: "Insight",
      replyToId: questionId,
      embedding: vector ? JSON.stringify(vector) : null,
    },
  })
  return true
}
