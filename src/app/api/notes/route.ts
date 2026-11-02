import { revalidatePath } from "next/cache"
import { cleanCategoryName, parsePurposes } from "@/features/notes/lib/topics"
import { parseLocalDateTime } from "@/features/notes/lib/time"
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
  time?: string
  ownCategory?: unknown
  sentiment?: unknown
} {
  return typeof body === "object" && body !== null
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
    // the day, and the time if you gave one ("HH:MM"); no day = now
    const date =
      (typeof body.date === "string" &&
        parseLocalDateTime(
          body.date,
          typeof body.time === "string" ? body.time : "",
        )) ||
      new Date()
    // the category you chose for it (up to three), and its tone, -2…2
    const ownCategory = Array.isArray(body.ownCategory)
      ? [
          ...new Set(
            body.ownCategory
              .map(cleanCategoryName)
              .filter((c): c is string => c !== null),
          ),
        ]
          .slice(0, 3)
          .join(",")
      : ""
    const sentiment =
      typeof body.sentiment === "number" &&
      Number.isInteger(body.sentiment) &&
      body.sentiment >= -2 &&
      body.sentiment <= 2
        ? body.sentiment
        : null

    const note = await createNote({
      title,
      content,
      category,
      tags,
      date,
      ownCategory,
      sentiment,
    })
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
