import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  ImportError,
  MAX_IMPORT_BYTES,
  textFromFile,
  textFromGoogleDoc,
} from "@/features/import/extract"
import { proposeEntries } from "@/features/import/ingest"
import {
  listLocalModels,
  OllamaUnavailableError,
} from "@/features/notes/services/ollama.service"

// Read a document (uploaded file, Google Doc link or pasted text) and propose
// entries with titles and dates. Nothing is saved until /api/import/commit.
export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const model = String(form.get("model") ?? "")
  const onlyOne = form.get("single") === "true"

  try {
    const installed = await listLocalModels()
    if (!installed.includes(model)) {
      throw new ImportError(`“${model}” isn’t installed in your local Ollama.`)
    }

    let source: string
    let text: string
    const file = form.get("file")
    const link = String(form.get("url") ?? "").trim()
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_IMPORT_BYTES)
        throw new ImportError("That file is over 5 MB.")
      text = await textFromFile(
        file.name,
        Buffer.from(await file.arrayBuffer()),
      )
      source = file.name.replace(/\.[^.]+$/, "")
    } else if (link) {
      const doc = await textFromGoogleDoc(link)
      text = doc.text
      source = doc.title
    } else {
      text = String(form.get("text") ?? "").trim()
      source = "Pasted text"
    }
    if (!text) throw new ImportError("There’s no text to import.")

    const entries = await proposeEntries(text, model, onlyOne)

    // flag entries whose text is already in the journal
    const existing = new Set(
      (await prisma.note.findMany({ select: { content: true } })).map((n) =>
        n.content.trim(),
      ),
    )

    return NextResponse.json({
      source,
      characters: text.length,
      entries: entries.map((e) => ({
        ...e,
        duplicate: existing.has(e.content.trim()),
      })),
    })
  } catch (error) {
    const status =
      error instanceof ImportError
        ? 400
        : error instanceof OllamaUnavailableError
          ? 503
          : 500
    if (status === 500) console.error("[import]", error)
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
