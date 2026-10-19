import { NextResponse } from "next/server"
import {
  askForChart,
  chartJobs,
  dismissChart,
} from "@/features/insights/chartJobs"

// Charts asked for in words, made in the background (see chartJobs):
//   POST   { question }  → the new job, queued; returns at once
//   GET                  → { jobs }: queued, being made, ready or failed
//   DELETE ?id=…         → dismiss one
// The jobs hold only chart specs; the numbers are computed in the browser.
export async function POST(req: Request) {
  let question: string
  try {
    const body = await req.json()
    question = String(body.question ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  if (!question) {
    return NextResponse.json({ error: "Ask a question first" }, { status: 400 })
  }
  return NextResponse.json({ job: askForChart(question.slice(0, 500)) })
}

export async function GET() {
  return NextResponse.json(
    { jobs: chartJobs() },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? ""
  return NextResponse.json({ ok: dismissChart(id) })
}
