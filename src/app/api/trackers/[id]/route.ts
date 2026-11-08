import { NextResponse } from "next/server"
import { cleanLegend, cleanScale } from "@/features/trackers/legend"
import { deleteTracker, updateTracker } from "@/features/trackers/trackers"

// PATCH { name?, legend? | scale? } renames it or changes its answers or
// scale (days answered with something it no longer has are cleared);
// DELETE removes it and its marks.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const legend =
    body?.legend !== undefined ? cleanLegend(body.legend) : undefined
  if (legend && legend.length < 2)
    return NextResponse.json(
      { error: "A tracker needs at least two answers." },
      { status: 400 },
    )
  const scale = body?.scale !== undefined ? cleanScale(body.scale) : undefined
  if (scale === null)
    return NextResponse.json(
      { error: "A scale needs a lowest number below its highest." },
      { status: 400 },
    )
  try {
    await updateTracker(id, {
      name: typeof body?.name === "string" ? body.name : undefined,
      kind: scale ? { scale } : legend ? { legend } : undefined,
    })
  } catch {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const undo = await deleteTracker(id)
    return NextResponse.json({ ok: true, undo })
  } catch {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }
}
