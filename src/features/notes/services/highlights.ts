import { prisma } from "@/lib/prisma"
import { findQuote } from "@/features/notes/lib/findQuote"

// An entry's highlights as they are now, for a page to redraw them after a
// change.
export const noteHighlights = (noteId: string) =>
  prisma.quote.findMany({
    where: { noteId },
    select: { id: true, quote: true, category: true },
  })

// A highlight and every other one on the same words of its entry (stacked
// highlights: removing only the top one would just reveal the next).
export async function highlightsAtSpot(id: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: {
      quote: true,
      note: {
        select: {
          content: true,
          quotes: { select: { id: true, quote: true } },
        },
      },
    },
  })
  if (!quote) return []
  const range = findQuote(quote.note.content, quote.quote)
  if (!range) return [id]
  return quote.note.quotes
    .filter((q) => {
      const other = findQuote(quote.note.content, q.quote)
      return (
        q.id === id ||
        (other && other.start < range.end && range.start < other.end)
      )
    })
    .map((q) => q.id)
}
