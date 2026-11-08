import { QuotesView } from "@/components/QuotesView"
import { NotebookTabs } from "@/components/TimelineTabs"
import { listQuotes, quotesEnabled } from "@/features/quotes/quotes"
import { dayKey } from "@/features/notes/lib/time"

export const dynamic = "force-dynamic"

export default async function QuotesPage() {
  const [quotes, on] = await Promise.all([listQuotes(), quotesEnabled()])
  return (
    <>
      <NotebookTabs />
      <QuotesView initial={quotes} on={on} today={dayKey(new Date())} />
    </>
  )
}
