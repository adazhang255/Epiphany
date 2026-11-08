import { NextResponse } from "next/server"
import { cleanLegend, cleanScale } from "@/features/trackers/legend"
import { createTracker, listTrackers } from "@/features/trackers/trackers"

// Trackers (day-by-day questions you answer yourself, on Stats → Trackers):
//   GET                    → { trackers } (null: run `npm run db:push` once)
//   POST { name, legend } or { name, scale } → the new tracker
export async function GET() {
  return NextResponse.json(
    { trackers: await listTrackers() },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const scale = body?.scale !== undefined ? cleanScale(body.scale) : null
  const legend = cleanLegend(body?.legend)
  if (!name)
    return NextResponse.json({ error: "Give it a question." }, { status: 400 })
  if (body?.scale !== undefined && !scale)
    return NextResponse.json(
      { error: "A scale needs a lowest number below its highest." },
      { status: 400 },
    )
  if (!scale && legend.length < 2)
    return NextResponse.json(
      { error: "Give it a question and at least two answers." },
      { status: 400 },
    )
  try {
    return NextResponse.json(
      await createTracker(name, scale ? { scale } : { legend }),
    )
  } catch {
    return NextResponse.json(
      { error: "Trackers aren't set up yet: run `npm run db:push` once." },
      { status: 503 },
    )
  }
}
