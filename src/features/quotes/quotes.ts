import { offerUndo } from "@/features/undo/undo"
import { prisma } from "@/lib/prisma"
import type { KeptQuote } from "@/features/quotes/lib"

export type { KeptQuote }

// Quotes you keep: words worth returning to, from books, people, anywhere,
// apart from your entries. An optional tab under Notebook: there only once
// you add it (and never on the public site).

const SECTION = "section:quotes"

export const SETUP_MESSAGE =
  "Quotes aren't set up yet: run `npm run db:push` once."

// whether an error means the database doesn't have the quotes tables yet
// (rather than anything else going wrong)
export const notSetUp = (error: unknown) =>
  /no such table|does not exist/i.test(
    error instanceof Error ? error.message : String(error),
  )

// what to tell you when something fails
export const problem = (error: unknown, doing: string) =>
  notSetUp(error)
    ? SETUP_MESSAGE
    : `Couldn't ${doing}. Try again, or restart the app.`

// whether you've added the Quotes section (false until the tables exist)
export async function quotesEnabled() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: SECTION } })
    return row?.value === "on"
  } catch {
    return false
  }
}

export async function setQuotesEnabled(on: boolean) {
  await prisma.setting.upsert({
    where: { key: SECTION },
    create: { key: SECTION, value: on ? "on" : "off" },
    update: { value: on ? "on" : "off" },
  })
}

const view = (q: {
  id: string
  text: string
  author: string
  source: string
  note: string
  createdAt: Date
}): KeptQuote => ({ ...q, createdAt: q.createdAt.toISOString() })

// newest first; null when the database doesn't have the table yet (run
// `npm run db:push` once); anything else that goes wrong is thrown
export async function listQuotes(): Promise<KeptQuote[] | null> {
  try {
    const rows = await prisma.inspiration.findMany({
      orderBy: { createdAt: "desc" },
    })
    return rows.map(view)
  } catch (error) {
    if (notSetUp(error)) return null
    throw error
  }
}

// what can be written to a quote, tidied; null without any words
export function cleanQuote(raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>
  const line = (v: unknown, most: number) =>
    String(v ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, most)
  const text = String(r.text ?? "")
    .trim()
    // the quote marks are drawn around it; typed ones would be doubled
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
    .trim()
    .slice(0, 2000)
  if (!text) return null
  return {
    text,
    author: line(r.author, 120).replace(/^[-–—]\s*/, ""),
    source: line(r.source, 160),
    note: String(r.note ?? "")
      .trim()
      .slice(0, 1000),
  }
}

export async function addQuote(
  data: NonNullable<ReturnType<typeof cleanQuote>>,
) {
  return view(await prisma.inspiration.create({ data }))
}

export async function updateQuote(
  id: string,
  data: NonNullable<ReturnType<typeof cleanQuote>>,
) {
  return view(await prisma.inspiration.update({ where: { id }, data }))
}

// Delete one. Gives a token to undo it.
export async function deleteQuote(id: string) {
  const row = await prisma.inspiration.findUniqueOrThrow({ where: { id } })
  await prisma.inspiration.delete({ where: { id } })
  return offerUndo("Quote deleted", () =>
    prisma.inspiration.create({ data: row }),
  )
}
