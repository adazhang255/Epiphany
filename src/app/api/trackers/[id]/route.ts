import { NextResponse } from "next/server"
import { cleanLegend } from "@/features/trackers/legend"
import { deleteTracker, updateTracker } from "@/features/trackers/trackers"

// PATCH { name?, legend? } renames it or changes its answers (marks for
// answers taken out go too); DELETE removes it and its marks.
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
  try {
    await updateTracker(id, {
      name: typeof body?.name === "string" ? body.name : undefined,
      legend,
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
    await deleteTracker(id)
  } catch {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
