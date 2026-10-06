import { NextResponse } from "next/server"
import { enqueueAnalysis } from "@/features/notes/services/analysis-queue"

// Queue entries for background analysis: { noteIds: string[] }.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const ids = Array.isArray(body?.noteIds)
    ? body.noteIds.filter((id: unknown): id is string => typeof id === "string")
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: "No entries given" }, { status: 400 })
  }
  enqueueAnalysis(ids)
  return NextResponse.json({ queued: ids.length })
}
