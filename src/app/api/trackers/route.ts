import { NextResponse } from "next/server"
import { cleanLegend } from "@/features/trackers/legend"
import { createTracker, listTrackers } from "@/features/trackers/trackers"

// Trackers (day-by-day questions you answer yourself, on Custom):
//   GET                    → { trackers } (null: run `npm run db:push` once)
//   POST { name, legend }  → the new tracker
export async function GET() {
  return NextResponse.json(
    { trackers: await listTrackers() },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const legend = cleanLegend(body?.legend)
  if (!name || legend.length < 2)
    return NextResponse.json(
      { error: "Give it a question and at least two answers." },
      { status: 400 },
    )
  try {
    return NextResponse.json(await createTracker(name, legend))
  } catch {
    return NextResponse.json(
      { error: "Trackers aren't set up yet: run `npm run db:push` once." },
      { status: 503 },
    )
  }
}
