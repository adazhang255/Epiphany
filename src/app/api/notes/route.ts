import { revalidatePath } from "next/cache"
import { parsePurposes } from "@/features/notes/lib/topics"
import { syncQuestions } from "@/features/questions/sync"
import { enqueueAnalysis } from "@/features/notes/services/analysis-queue"
import { NextResponse } from "next/server"
import {
  createNote,
  getTimeline,
} from "@/features/notes/services/notes.service"

function isValidPayload(body: unknown): body is {
  title?: string
  content?: string
  category?: string
  purposes?: unknown[]
  tags?: string
  date?: string
} {
  return typeof body === "object" && body !== null
}

function parseLocalDate(dateString: string | undefined) {
  if (!dateString) {
    return new Date()
  }

  const [year, month, day] = dateString.split("-").map(Number)
  if (!year || !month || !day) {
    return new Date()
  }

  return new Date(year, month - 1, day)
}

export async function GET() {
  const notes = await getTimeline()

  return NextResponse.json(notes)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (
      !isValidPayload(body) ||
      typeof body.content !== "string" ||
      body.content.trim() === ""
    ) {
      return NextResponse.json(
        {
          error: "A thought body is required",
        },
        {
          status: 400,
        },
      )
    }

    const title =
      // left untitled: the local AI writes a temporary title after it's read
      typeof body.title === "string" ? body.title.trim() : ""
    const content = body.content.trim()
    // category = Writing / Insight / Event / Emotion; empty lets the AI decide
    const category = parsePurposes(
      Array.isArray(body.purposes)
        ? body.purposes.map(String).join(",")
        : typeof body.category === "string"
          ? body.category
          : "",
    ).join(",")
    const tags = typeof body.tags === "string" ? body.tags.trim() : ""
    const date = parseLocalDate(
      typeof body.date === "string" ? body.date : undefined,
    )

    const note = await createNote({ title, content, category, tags, date })
    // Questions are found by rule, instantly; highlights in the background,
    // so saving returns at once and you can leave the page.
    await syncQuestions([note.id])
    if ((body as { analyze?: unknown }).analyze !== false)
      enqueueAnalysis([note.id])
    revalidatePath("/", "layout")

    return NextResponse.json(note)
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request",
      },
      {
        status: 400,
      },
    )
  }
}
