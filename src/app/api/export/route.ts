import { prisma } from "@/lib/prisma"
import { entriesDocx } from "@/features/export/docx"
import { titleText } from "@/features/notes/lib/titles"

// Export entries as a .docx for Google Docs (or Word):
//   POST { ids?: string[] }  → the file; no ids: the whole journal.
// Oldest first, like reading a journal.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown): x is string => typeof x === "string")
    : null
  const notes = await prisma.note.findMany({
    where: ids ? { id: { in: ids } } : {},
    select: { title: true, date: true, content: true },
    orderBy: { date: "asc" },
  })
  if (notes.length === 0)
    return Response.json({ error: "No entries to export" }, { status: 404 })

  const title = notes.length === 1 ? titleText(notes[0].title) : "Journal"
  const file = await entriesDocx(notes, title)
  const now = new Date()
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const name =
    notes.length === 1
      ? `${
          title
            .replace(/[^\w\s-]/g, "")
            .trim()
            .slice(0, 60) || "Entry"
        }.docx`
      : `Journal ${day}.docx`
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  })
}
