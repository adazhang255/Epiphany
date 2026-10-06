import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { runAnalysis } from "@/features/notes/services/analysis"
import { runTracked } from "@/features/notes/services/analysis-queue"
import { getNoteById } from "@/features/notes/services/notes.service"
import { OllamaUnavailableError } from "@/features/notes/services/ollama.service"

function isValidPayload(
  body: unknown,
): body is { noteId?: string; model?: string } {
  return typeof body === "object" && body !== null
}

// Analyze one entry right now and wait for it (Find / Regenerate highlights).
// New entries are analyzed in the background instead (analysis-queue.ts).
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (
    !isValidPayload(body) ||
    typeof body.noteId !== "string" ||
    !body.noteId.trim()
  ) {
    return NextResponse.json(
      { error: "A note ID is required" },
      { status: 400 },
    )
  }

  const note = await getNoteById(body.noteId.trim())
  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 })
  }

  try {
    const result = await runTracked(note.id, () =>
      runAnalysis(
        note.id,
        typeof body.model === "string" && body.model ? body.model : undefined,
      ),
    )
    revalidatePath("/", "layout")
    return NextResponse.json(result)
  } catch (error) {
    console.error("[highlights]", error)
    const status = error instanceof OllamaUnavailableError ? 503 : 500
    const message =
      error instanceof OllamaUnavailableError
        ? error.message
        : "Unable to generate highlights"
    return NextResponse.json({ error: message }, { status })
  }
}
