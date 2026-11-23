import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { parseThread, threadField } from "@/features/threads/field"

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

// How the given passages are threaded now (their thread, and for highlights
// which question they answer), and a way to put that back: undo for taking
// things out of threads.
export async function keepThreading(where: {
  quotes: Prisma.QuoteWhereInput
  questions?: Prisma.QuestionWhereInput
}) {
  const [quotes, questions] = await Promise.all([
    prisma.quote.findMany({
      where: where.quotes,
      select: { id: true, thread: true, replyToId: true, manual: true },
    }),
    where.questions
      ? prisma.question.findMany({
          where: where.questions,
          select: { id: true, thread: true },
        })
      : [],
  ])
  return () =>
    prisma.$transaction([
      ...quotes.map(({ id, ...data }) =>
        prisma.quote.updateMany({ where: { id }, data }),
      ),
      ...questions.map(({ id, ...data }) =>
        prisma.question.updateMany({ where: { id }, data }),
      ),
    ])
}

// the passages behind ids as the page has them ("q-" + id for a question)
const byIds = (ids: string[]) => ({
  quotes: { id: { in: ids.filter((id) => !id.startsWith("q-")) } },
  questions: {
    id: {
      in: ids.filter((id) => id.startsWith("q-")).map((id) => id.slice(2)),
    },
  },
})

// Put passages (one or several) in a thread. An automatic thread becomes
// one you arranged (its passages keep it, so it stays together); a
// question's thread gets the highlights as answers (a question can't be
// one). Gives the thread's id afterwards (null if none can go there).
export async function addToThread(items: string | string[], thread: ThreadRef) {
  const ids = [items].flat().filter((id) => !thread.memberIds.includes(id))
  if (ids.length === 0) return thread.id
  if (thread.kind === "qa") {
    const quotes = ids.filter((id) => !id.startsWith("q-"))
    if (quotes.length === 0 || !thread.questionId) return null
    await prisma.quote.updateMany({
      where: { id: { in: quotes } },
      data: { replyToId: thread.questionId },
    })
    return thread.id
  }
  if (thread.kind === "pinned") {
    // join under the same id (and name, if it has one)
    await setThread(ids, await storedField(thread.id))
    return thread.id
  }
  const id = `t-${randomUUID()}`
  await setThread([...thread.memberIds, ...ids], id)
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
// Gives the thread's id now (an automatic one becomes yours), or false.
export async function renameThread(thread: ThreadRef, name: string) {
  if (thread.kind === "qa") return false
  if (thread.kind === "auto") {
    const id = `t-${randomUUID()}`
    await setThread(thread.memberIds, threadField(id, name))
    return id
  }
  const match = {
    OR: [{ thread: thread.id }, { thread: { startsWith: `${thread.id}::` } }],
  }
  const value = threadField(thread.id, name)
  await prisma.$transaction([
    prisma.quote.updateMany({ where: match, data: { thread: value } }),
    prisma.question.updateMany({ where: match, data: { thread: value } }),
  ])
  return thread.id
}

// Take a passage out of a thread: no longer an answer (question threads), or
// left out of threads altogether. Nothing in the entry changes. The rest of
// the thread stays a thread, even with one passage left: an automatic one
// becomes one you arranged, so the grouping can't split or drop it. Gives
// a way to put it back and the thread's id now (false if it can't be
// removed).
export async function removeFromThread(item: string, thread: ThreadRef) {
  if (thread.kind === "qa") {
    if (item.startsWith("q-")) return false
    const restore = await keepThreading(byIds([item]))
    // kept as your highlight, so finding answers won't link it again
    await prisma.quote.update({
      where: { id: item },
      data: { replyToId: null, manual: true },
    })
    return { restore, thread: thread.id }
  }
  if (thread.kind === "pinned") {
    const restore = await keepThreading(byIds([item]))
    await setThread([item], "none")
    return { restore, thread: thread.id }
  }
  const restore = await keepThreading(byIds(thread.memberIds))
  const id = `t-${randomUUID()}`
  await setThread(
    thread.memberIds.filter((m) => m !== item),
    id,
  )
  await setThread([item], "none")
  return { restore, thread: id }
}

// Take a whole thread apart. Its passages are left out of threads (so the
// automatic grouping doesn't put them back together); a question's thread
// has its answers unlinked, kept as your highlights (so finding answers
// won't link them again). The entries and highlights themselves stay. Gives
// a way to put it back (false if it can't be removed).
export async function removeThread(thread: ThreadRef) {
  if (thread.kind === "qa") {
    if (!thread.questionId) return false
    const restore = await keepThreading({
      quotes: { replyToId: thread.questionId },
    })
    await prisma.quote.updateMany({
      where: { replyToId: thread.questionId },
      data: { replyToId: null, manual: true },
    })
    return restore
  }
  if (thread.kind === "pinned") {
    // everything carrying its id (and name), including any not listed
    const match = {
      OR: [{ thread: thread.id }, { thread: { startsWith: `${thread.id}::` } }],
    }
    const restore = await keepThreading({ quotes: match, questions: match })
    await prisma.$transaction([
      prisma.quote.updateMany({ where: match, data: { thread: "none" } }),
      prisma.question.updateMany({ where: match, data: { thread: "none" } }),
    ])
    return restore
  }
  const restore = await keepThreading(byIds(thread.memberIds))
  await setThread(thread.memberIds, "none")
  return restore
}

// Keep a thread as it is: an automatic one becomes one you arranged, so its
// passages stay together under an id that lasts (e.g. to star it). Gives
// that id (a thread you arranged, or a question's, keeps its own).
export async function keepThread(thread: ThreadRef) {
  if (thread.kind !== "auto") return thread.id
  const id = `t-${randomUUID()}`
  await setThread(thread.memberIds, id)
  return id
}

// Start a thread of your own from passages (one or several), named
// `name`. Gives the new thread's id. (A passage that was in another thread
// of yours moves.)
export async function startThread(items: string | string[], name: string) {
  const id = `t-${randomUUID()}`
  await setThread([items].flat(), threadField(id, name))
  return id
}

// Merge thread `from` into thread `into` (neither a question's thread): one
// thread of yours with every passage of both. Named `name` if given;
// otherwise it keeps `into`'s name, or `from`'s if `into` has none. Gives
// the merged thread's id and a way to put both back as they were (null if
// they can't be merged).
export async function mergeThreads(
  from: ThreadRef,
  into: ThreadRef,
  chosen?: string | null,
) {
  if (from.kind === "qa" || into.kind === "qa" || from.id === into.id)
    return null
  const pinnedIds = [from, into]
    .filter((t) => t.kind === "pinned")
    .map((t) => t.id)
  const carrying = pinnedIds.flatMap((id) => [
    { thread: id },
    { thread: { startsWith: `${id}::` } },
  ])
  // the passages shown in either, and all carrying either's id
  const shown = byIds([...from.memberIds, ...into.memberIds])
  const quotes = { OR: [shown.quotes, ...carrying] }
  const questions = { OR: [shown.questions, ...carrying] }
  const restore = await keepThreading({ quotes, questions })

  const nameOf = async (t: ThreadRef) => {
    if (t.kind !== "pinned") return null
    const parsed = parseThread(await storedField(t.id))
    return parsed.kind === "pinned" ? parsed.name : null
  }
  const name = chosen || (await nameOf(into)) || (await nameOf(from))
  const id =
    into.kind === "pinned"
      ? into.id
      : from.kind === "pinned"
        ? from.id
        : `t-${randomUUID()}`
  const value = threadField(id, name)
  await prisma.$transaction([
    prisma.quote.updateMany({ where: quotes, data: { thread: value } }),
    prisma.question.updateMany({ where: questions, data: { thread: value } }),
  ])
  return { id, restore }
}
