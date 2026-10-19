import { prisma } from "@/lib/prisma"
import { entriesDocx } from "@/features/export/docx"
import { entriesHtml, entriesText } from "@/features/export/html"
import { titleText } from "@/features/notes/lib/titles"

// Export entries for Google Docs:
//   POST { ids?: string[], format?: "docx" | "html" }
//   docx (default): a .docx file (opens in Google Docs or Word);
//   html: { html, text } to copy and paste into a new Google Doc.
//   No ids: the whole journal.
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
  if (body?.format === "html")
    return Response.json(
      {
        html: entriesHtml(notes, title),
        text: entriesText(notes),
        count: notes.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
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
