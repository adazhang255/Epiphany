import { prisma } from "@/lib/prisma"

// Highlights whose words match, for picking one to add to a thread: ?q=…
// (newest first, at most 20). Empty q gives the newest.
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase()
  const quotes = await prisma.quote.findMany({
    select: {
      id: true,
      quote: true,
      category: true,
      note: { select: { title: true, date: true } },
    },
    orderBy: { note: { date: "desc" } },
  })
  const words = q.split(/\s+/).filter(Boolean)
  const matches = quotes
    .filter((h) =>
      words.every((w) =>
        `${h.quote} ${h.note.title}`.toLowerCase().includes(w),
      ),
    )
    .slice(0, 20)
  return Response.json({
    highlights: matches.map((h) => ({
      id: h.id,
      quote: h.quote,
      category: h.category,
      noteTitle: h.note.title,
      date: h.note.date.toISOString(),
    })),
  })
}
