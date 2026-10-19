import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { syncQuestions } from "@/features/questions/sync"
import { enqueueAnalysis } from "@/features/notes/services/analysis-queue"

type Incoming = { title?: unknown; date?: unknown; content?: unknown }

function localDate(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date()
}

// Save the entries the user approved on the import review screen.
export async function POST(req: Request) {
  let body: {
    source?: unknown
    entries?: unknown
    analyze?: unknown
    model?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: "Nothing to import" }, { status: 400 })
  }

  const source =
    typeof body.source === "string" && body.source.trim()
      ? `Imported: ${body.source.trim()}`.slice(0, 200)
      : "Imported"

  const entries = (body.entries as Incoming[]).filter(
    (e) => typeof e.content === "string" && e.content.trim(),
  )
  const created = await prisma.$transaction(
    entries.map((e) =>
      prisma.note.create({
        data: {
          title:
            typeof e.title === "string" && e.title.trim() ? e.title.trim() : "",
          content: String(e.content).trim(),
          date: localDate(e.date),
          category: "", // set by analysis
          source,
        },
        select: { id: true },
      }),
    ),
  )

  const ids = created.map((n) => n.id)
  await syncQuestions(ids)
  if (body.analyze !== false) {
    enqueueAnalysis(
      ids,
      typeof body.model === "string" && body.model ? body.model : undefined,
    )
  }
  revalidatePath("/", "layout")
  return NextResponse.json({ ids })
}
