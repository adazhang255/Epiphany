import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { HIGHLIGHT_STARS, setStarred } from "@/features/notes/stars"

// Star a highlight as a favourite, or take its star off: { starred: boolean }.
// (A starred highlight is kept when an entry's highlights are found again.)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (typeof body?.starred !== "boolean")
    return NextResponse.json(
      { error: "starred: true or false" },
      { status: 400 },
    )
  const exists = await prisma.quote.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!exists)
    return NextResponse.json({ error: "No such highlight" }, { status: 404 })
  await setStarred(id, body.starred, HIGHLIGHT_STARS)
  return NextResponse.json({ starred: body.starred })
}
