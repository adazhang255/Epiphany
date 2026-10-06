import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { threadField } from "@/features/threads/field"

// Changing which thread a passage is in, stored on the passage itself:
// Quote.thread / Question.thread (see field.ts: null = automatic, "t-…" = a
// thread you arranged, "t-…::name" = named, "none" = left out of threads). A question's thread is its
// answers, so there it's Quote.replyToId instead.

export type ThreadRef = {
  id: string
  kind: "auto" | "pinned" | "qa"
  questionId?: string
  memberIds: string[] // highlight ids, or "q-" + question id
}

async function setThread(ids: string[], thread: string | null) {
  const questions = ids
    .filter((id) => id.startsWith("q-"))
    .map((id) => id.slice(2))
  const quotes = ids.filter((id) => !id.startsWith("q-"))
  await prisma.$transaction([
    prisma.quote.updateMany({
      where: { id: { in: quotes } },
      data: { thread },
    }),
    prisma.question.updateMany({
      where: { id: { in: questions } },
      data: { thread },
    }),
  ])
}

// Put a passage in a thread. An automatic thread becomes one you arranged
// (its passages keep it, so it stays together); a question's thread gets the
// highlight as an answer. Gives the thread's id afterwards (null if it can't
// go there).
export async function addToThread(item: string, thread: ThreadRef) {
  if (thread.kind === "qa") {
    if (item.startsWith("q-") || !thread.questionId) return null
    await prisma.quote.update({
      where: { id: item },
      data: { replyToId: thread.questionId },
    })
    return thread.id
  }
  if (thread.kind === "pinned") {
    // join under the same id (and name, if it has one)
    await setThread([item], await storedField(thread.id))
    return thread.id
  }
  const id = `t-${randomUUID()}`
  await setThread([...thread.memberIds, item], id)
  return id
}

// the `thread` value a thread's passages carry (its id, and name if named)
async function storedField(id: string) {
  const match = { OR: [{ thread: id }, { thread: { startsWith: `${id}::` } }] }
  const one =
    (await prisma.quote.findFirst({
      where: match,
      select: { thread: true },
    })) ??
    (await prisma.question.findFirst({
      where: match,
      select: { thread: true },
    }))
  return one?.thread ?? id
}

// Name a thread (or, with an empty name, go back to the automatic title).
// An automatic thread becomes one you arranged, so the name stays with it.
// A question's thread is titled by its question.
export async function renameThread(thread: ThreadRef, name: string) {
  if (thread.kind === "qa") return false
  if (thread.kind === "auto") {
    await setThread(thread.memberIds, threadField(`t-${randomUUID()}`, name))
    return true
  }
  const match = {
    OR: [{ thread: thread.id }, { thread: { startsWith: `${thread.id}::` } }],
  }
  const value = threadField(thread.id, name)
  await prisma.$transaction([
    prisma.quote.updateMany({ where: match, data: { thread: value } }),
    prisma.question.updateMany({ where: match, data: { thread: value } }),
  ])
  return true
}

// Take a passage out of a thread: no longer an answer (question threads), or
// left out of threads altogether. Nothing in the entry changes.
export async function removeFromThread(item: string, thread: ThreadRef) {
  if (thread.kind === "qa") {
    if (item.startsWith("q-")) return false
    // kept as your highlight, so finding answers won't link it again
    await prisma.quote.update({
      where: { id: item },
      data: { replyToId: null, manual: true },
    })
    return true
  }
  await setThread([item], "none")
  return true
}
