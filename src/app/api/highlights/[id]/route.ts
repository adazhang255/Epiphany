import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cleanCategoryName } from "@/features/notes/lib/topics"
import {
  highlightsAtSpot,
  noteHighlights,
} from "@/features/notes/services/highlights"

// Change a highlight's type: { category }, a built-in type or a name of your
// own. Once you've chosen it, it counts as yours and survives regenerating
// highlights. Or { replyTo: null }: it doesn't answer the question it was
// linked to; it stays as your highlight, so "Find answers" leaves it alone.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (body && "replyTo" in body && body.replyTo === null) {
    try {
      await prisma.quote.update({
        where: { id },
        data: { replyToId: null, manual: true },
      })
    } catch {
      return NextResponse.json(
        { error: "Highlight not found" },
        { status: 404 },
      )
    }
    revalidatePath("/", "layout")
    return NextResponse.json({ ok: true })
  }
  const category = cleanCategoryName(body?.category)
  if (!category) {
    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  }
  let noteId: string
  try {
    ;({ noteId } = await prisma.quote.update({
      where: { id },
      data: { category, manual: true },
    }))
  } catch {
    return NextResponse.json({ error: "Highlight not found" }, { status: 404 })
  }
  revalidatePath("/", "layout")
  return NextResponse.json({
    ok: true,
    highlights: await noteHighlights(noteId),
  })
}

// Remove a highlight (the entry's text is untouched). With ?spot=1, every
// highlight on those same words goes too, so the spot is really cleared
// rather than showing the one underneath.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const found = await prisma.quote.findUnique({
    where: { id },
    select: { noteId: true },
  })
  if (!found) {
    return NextResponse.json({ error: "Highlight not found" }, { status: 404 })
  }
  const spot = new URL(req.url).searchParams.get("spot") === "1"
  const ids = spot ? await highlightsAtSpot(id) : [id]
  await prisma.quote.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/", "layout")
  return NextResponse.json({
    ok: true,
    removed: ids.length,
    highlights: await noteHighlights(found.noteId),
  })
}
