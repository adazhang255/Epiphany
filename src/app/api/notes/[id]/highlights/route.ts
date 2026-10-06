import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { findQuote, snapToWords } from "@/features/notes/lib/findQuote"
import { cleanCategoryName } from "@/features/notes/lib/topics"
import { embed } from "@/features/notes/services/embeddings.service"
import { noteHighlights } from "@/features/notes/services/highlights"

// Mark a passage of an entry yourself: { text, category, start?, end? }. The
// category is a built-in type or a name of your own. start/end say exactly
// where the selected text is (so a phrase that appears twice is marked where
// you selected it); without them the text is looked up. It's stored exactly
// as written there. Any highlights it overlaps are replaced. Answers with the
// entry's highlights as they are now.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: {
    text?: unknown
    category?: unknown
    start?: unknown
    end?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const category = cleanCategoryName(body.category)
  if (typeof body.text !== "string" || !body.text.trim() || !category) {
    return NextResponse.json(
      { error: "Select some text and choose a type" },
      { status: 400 },
    )
  }

  const note = await prisma.note.findUnique({
    where: { id },
    select: {
      content: true,
      quotes: { select: { id: true, quote: true, replyToId: true } },
    },
  })
  if (!note) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 })
  }
  // where you selected it, if that's really the text there; else look it up
  const at =
    typeof body.start === "number" &&
    typeof body.end === "number" &&
    note.content.slice(body.start, body.end) === body.text
      ? { start: body.start, end: body.end }
      : null
  const found = at ?? findQuote(note.content, body.text)
  // whole words only, even if the drag started or ended mid-word
  const range = found ? snapToWords(note.content, found) : null
  if (!range) {
    return NextResponse.json(
      { error: "That selection isn't part of the entry's text" },
      { status: 400 },
    )
  }
  const text = note.content.slice(range.start, range.end)
  // Re-marking words that are already highlighted replaces those highlights
  // with this one (an answer to a question stays linked to it).
  const overlapping = note.quotes.filter((q) => {
    const other = findQuote(note.content, q.quote)
    return other && other.start < range.end && range.start < other.end
  })

  // embedding is a bonus (threads, Ask); never block on it
  const [vector] = await embed([text]).catch(() => [] as number[][])
  const [, quote] = await prisma.$transaction([
    prisma.quote.deleteMany({
      where: { id: { in: overlapping.map((q) => q.id) } },
    }),
    prisma.quote.create({
      data: {
        noteId: id,
        quote: text,
        category,
        manual: true,
        replyToId: overlapping.find((q) => q.replyToId)?.replyToId ?? null,
        embedding: vector ? JSON.stringify(vector) : null,
      },
    }),
  ])
  revalidatePath("/", "layout")
  return NextResponse.json({
    id: quote.id,
    replaced: overlapping.length,
    highlights: await noteHighlights(id),
  })
}
