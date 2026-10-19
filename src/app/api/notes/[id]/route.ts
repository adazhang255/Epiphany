import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { findQuote, snapToWords } from "@/features/notes/lib/findQuote"
import { cleanCategoryName, parsePurposes } from "@/features/notes/lib/topics"
import { embed } from "@/features/notes/services/embeddings.service"
import { syncQuestions } from "@/features/questions/sync"
import { enqueueAnalysis } from "@/features/notes/services/analysis-queue"
import { scheduleToneFill } from "@/features/notes/services/tone-queue"
import { scheduleTitleFill } from "@/features/notes/services/title-queue"
import {
  isAutoTitle,
  isUntitled,
  plainTitle,
} from "@/features/notes/lib/titles"
import {
  deleteWithBackup,
  loadForBackup,
} from "@/features/notes/services/delete.service"

// Update an entry: { published?: boolean, purposes?: string[], title?,
// content?, date?: "YYYY-MM-DD", tags?: string (added to your own,
// comma-separated) or string[] (the entry's whole set, replacing the AI's),
// ownCategory?: string[] (the entry's category, chosen by you; [] goes back
// to the one from its highlights), highlights?: { id, quote }[] (new words
// for highlights you reshaped), removedHighlights?: string[],
// addedHighlights?: { quote, category }[], sentiment?: -2…2 | null }. published puts it in (or takes it out of)
// the next site build; purposes is its categories (any of Writing / Insight /
// Event / Emotion). Edited text is read again: questions now, highlights and
// its embedding in the background.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: {
    published?: unknown
    purposes?: unknown
    title?: unknown
    content?: unknown
    date?: unknown
    tags?: unknown
    ownCategory?: unknown
    highlights?: unknown
    removedHighlights?: unknown
    addedHighlights?: unknown
    sentiment?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const data: {
    published?: boolean
    category?: string
    title?: string
    content?: string
    date?: Date
    embedding?: null
    tags?: string
    autoTags?: string
    ownCategory?: string
    sentiment?: number | null
  } = {}
  if (typeof body.published === "boolean") data.published = body.published
  if (Array.isArray(body.purposes)) {
    data.category = parsePurposes(body.purposes.map(String).join(",")).join(",")
  }
  if (typeof body.title === "string") {
    const title = body.title.trim()
    const before = await prisma.note.findUnique({
      where: { id },
      select: { title: true },
    })
    // the AI's temporary title sent back unchanged stays temporary (grey);
    // any other title is yours
    data.title =
      before &&
      isAutoTitle(before.title) &&
      title === plainTitle(before.title).trim()
        ? before.title
        : plainTitle(title)
    // cleared: it gets a temporary one again
    if (isUntitled(data.title as string)) scheduleTitleFill()
  }
  // tags: a string adds to your own; a list is the entry's whole set as you
  // reviewed it (the AI's suggestions included), so it replaces both
  const cleanTags = (list: unknown[]) =>
    [
      ...new Set(
        list
          .flatMap((t) => String(t).split(","))
          .map((t) => t.trim().toLowerCase().replace(/^#+/, ""))
          .filter(Boolean),
      ),
    ].join(",")
  if (typeof body.tags === "string") data.tags = cleanTags([body.tags])
  if (Array.isArray(body.tags)) {
    data.tags = cleanTags(body.tags)
    data.autoTags = ""
  }
  // the entry's overall tone, -2 (very negative) … 2 (very positive), as you
  // judge it; null hands it back to the model to score
  if (body.sentiment === null) data.sentiment = null
  else if (
    typeof body.sentiment === "number" &&
    Number.isInteger(body.sentiment) &&
    body.sentiment >= -2 &&
    body.sentiment <= 2
  )
    data.sentiment = body.sentiment
  if (Array.isArray(body.ownCategory)) {
    data.ownCategory = [
      ...new Set(
        body.ownCategory
          .map(cleanCategoryName)
          .filter((c): c is string => c !== null),
      ),
    ]
      .slice(0, 3)
      .join(",")
  }
  if (typeof body.content === "string") {
    if (!body.content.trim()) {
      return NextResponse.json(
        { error: "An entry needs some text" },
        { status: 400 },
      )
    }
    data.content = body.content.trim()
  }
  if (typeof body.date === "string") {
    const [y, m, d] = body.date.split("-").map(Number)
    if (!y || !m || !d) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 })
    }
    data.date = new Date(y, m - 1, d)
  }
  // (a change to the highlights alone, e.g. ones marked on the notebook's
  // blank page right after it's saved, is an update too)
  const changesHighlights = [
    body.highlights,
    body.removedHighlights,
    body.addedHighlights,
  ].some((list) => Array.isArray(list) && list.length > 0)
  if (Object.keys(data).length === 0 && !changesHighlights) {
    return NextResponse.json(
      {
        error:
          "Send published (true/false), purposes (a list), title, content, date or highlights",
      },
      { status: 400 },
    )
  }

  const before = await prisma.note.findUnique({
    where: { id },
    select: { content: true },
  })
  if (!before) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 })
  }
  const rewritten =
    data.content !== undefined && data.content !== before.content
  // its old embedding describes the old text
  if (rewritten) data.embedding = null

  if (Object.keys(data).length > 0)
    await prisma.note.update({ where: { id }, data })

  // Highlights you changed while editing: { id, quote, category? }, with
  // their words now (which must be in the saved text). They become yours, so
  // the re-read of the new text keeps them. Ones whose words you deleted go.
  if (Array.isArray(body.highlights) && body.highlights.length) {
    const text = data.content ?? before.content
    const changes: { id: string; quote: string; category: string | null }[] = []
    for (const raw of body.highlights) {
      const h = raw as { id?: unknown; quote?: unknown; category?: unknown }
      if (typeof h.id !== "string" || typeof h.quote !== "string") continue
      const found = findQuote(text, h.quote)
      const range = found ? snapToWords(text, found) : null
      const quote = range ? text.slice(range.start, range.end).trim() : ""
      if (!quote) continue
      changes.push({ id: h.id, quote, category: cleanCategoryName(h.category) })
    }
    const vectors = await embed(changes.map((c) => c.quote)).catch(
      () => [] as number[][],
    )
    await prisma.$transaction(
      changes.map((c, i) =>
        prisma.quote.updateMany({
          where: { id: c.id, noteId: id },
          data: {
            quote: c.quote,
            ...(c.category ? { category: c.category } : {}),
            manual: true,
            embedding: vectors[i] ? JSON.stringify(vectors[i]) : null,
          },
        }),
      ),
    )
  }
  if (Array.isArray(body.removedHighlights) && body.removedHighlights.length) {
    await prisma.quote.deleteMany({
      where: {
        noteId: id,
        id: { in: body.removedHighlights.filter((x) => typeof x === "string") },
      },
    })
  }

  // Highlights you marked while editing: { quote, category }. Each replaces
  // any highlight it overlaps, and is yours.
  if (Array.isArray(body.addedHighlights) && body.addedHighlights.length) {
    const text = data.content ?? before.content
    for (const raw of body.addedHighlights) {
      const h = raw as { quote?: unknown; category?: unknown }
      const category = cleanCategoryName(h.category)
      if (typeof h.quote !== "string" || !category) continue
      const found = findQuote(text, h.quote)
      if (!found) continue
      const range = snapToWords(text, found)
      const quote = text.slice(range.start, range.end).trim()
      if (!quote) continue
      const existing = await prisma.quote.findMany({
        where: { noteId: id },
        select: { id: true, quote: true, replyToId: true },
      })
      const overlapping = existing.filter((q) => {
        const other = findQuote(text, q.quote)
        return other && other.start < range.end && range.start < other.end
      })
      const [vector] = await embed([quote]).catch(() => [] as number[][])
      await prisma.$transaction([
        prisma.quote.deleteMany({
          where: { id: { in: overlapping.map((q) => q.id) } },
        }),
        prisma.quote.create({
          data: {
            noteId: id,
            quote,
            category,
            manual: true,
            replyToId: overlapping.find((q) => q.replyToId)?.replyToId ?? null,
            embedding: vector ? JSON.stringify(vector) : null,
          },
        }),
      ])
    }
  }

  if (body.sentiment === null) scheduleToneFill()
  if (rewritten) {
    await syncQuestions([id])
    enqueueAnalysis([id])
  }
  revalidatePath("/", "layout")
  return NextResponse.json({ ok: true })
}

// Delete an entry, after the person confirms it in the app. Same-origin only,
// and a backup (with its highlights and questions) is written first.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = req.headers.get("origin")
  const host = req.headers.get("host")
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 })
  }
  const { id } = await params
  const notes = await loadForBackup([id])
  if (notes.length === 0) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 })
  }
  const backup = await deleteWithBackup(notes)
  revalidatePath("/", "layout")
  return NextResponse.json({ deleted: 1, backup })
}
