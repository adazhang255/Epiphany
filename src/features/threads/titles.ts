import { prisma } from "@/lib/prisma"
import {
  chatJSON,
  pickTagModel,
} from "@/features/notes/services/ollama.service"

// A short title for a thread: the idea its highlights share, named by the
// local model. Kept for this server's lifetime, keyed by the highlights in
// the thread, so a thread is only named once (until it changes).

const TITLE_PROMPT = `You name a thread of passages from someone's private journal, written on different days about the same idea.
Give a short title (2 to 5 words) naming that shared idea, the way a chapter title would. Use plain words from the journal's own world; no quotation marks, no ending punctuation, not a full sentence.`

const store = globalThis as unknown as {
  __threadTitles?: Map<string, string>
  __threadTitling?: Promise<unknown>
}
const titles: Map<string, string> = (store.__threadTitles ??= new Map())

export const threadKey = (quoteIds: string[]) => [...quoteIds].sort().join(",")

export const knownTitle = (quoteIds: string[]) =>
  titles.get(threadKey(quoteIds)) ?? null

export async function titleThread(quoteIds: string[]) {
  const key = threadKey(quoteIds)
  const known = titles.get(key)
  if (known) return known

  // one at a time, so a page of threads doesn't swamp the local model
  const previous = store.__threadTitling ?? Promise.resolve()
  const work = previous
    .catch(() => {})
    .then(async () => {
      const again = titles.get(key)
      if (again) return again
      const quotes = await prisma.quote.findMany({
        where: { id: { in: quoteIds } },
        select: { quote: true },
      })
      if (quotes.length === 0) return null
      const model = await pickTagModel()
      const { title } = await chatJSON<{ title: string }>(
        TITLE_PROMPT,
        quotes.map((q, i) => `${i + 1}. ${q.quote}`).join("\n"),
        {
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
        },
        { temperature: 0.2, model },
      )
      const clean = String(title ?? "")
        .replace(/^["“'”]+|["“'”.!?]+$/g, "")
        .trim()
        .slice(0, 60)
      if (!clean) return null
      const named = clean[0].toUpperCase() + clean.slice(1)
      titles.set(key, named)
      return named
    })
  store.__threadTitling = work
  return work
}
