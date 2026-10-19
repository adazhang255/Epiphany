import { Suspense } from "react"
import { OnThisDayView } from "@/components/OnThisDayView"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// On this day: the page loads every entry once; which day (?date, or today)
// is worked out in the browser, so a page built once stays current.
export default async function OnThisDayPage() {
  const notes = await prisma.note.findMany({
    orderBy: { date: "asc" },
    select: {
      id: true,
      title: true,
      date: true,
      content: true,
      ownCategory: true,
      quotes: {
        select: { id: true, quote: true, category: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  return (
    <Suspense>
      <OnThisDayView notes={notes} />
    </Suspense>
  )
}
