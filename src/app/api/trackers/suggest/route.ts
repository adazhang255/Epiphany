import { NextResponse } from "next/server"
import { OllamaUnavailableError } from "@/features/notes/services/ollama.service"
import { suggestLegend } from "@/features/trackers/trackers"

// POST { question } → { legend }: answers for a new tracker, suggested by the
// local model (you can change them before creating it).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const question =
    typeof body?.question === "string" ? body.question.trim().slice(0, 200) : ""
  if (!question)
    return NextResponse.json({ error: "Ask a question first" }, { status: 400 })
  try {
    return NextResponse.json({ legend: await suggestLegend(question) })
  } catch (error) {
    const status = error instanceof OllamaUnavailableError ? 503 : 500
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
