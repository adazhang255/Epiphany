import { Suspense } from "react"
import { NotebookView } from "@/components/NotebookView"
import { NotebookTabs } from "@/components/TimelineTabs"
import { quotesEnabled } from "@/features/quotes/quotes"
import { PUBLIC_SITE } from "@/lib/site-mode"
import { listTrackers } from "@/features/trackers/trackers"
import {
  getCustomCategories,
  getNotebookFacets,
  getNotebookPage,
} from "@/features/notes/services/notes.service"

export const dynamic = "force-dynamic"

// Every entry in full, as notebook pages. The page loads them all once; the
// view applies ?filter, ?category and ?q in the browser and adds pages as you
// scroll (so the public site, built once, works the same way).
export default async function NotebookPage() {
  const [facets, custom, all, quotes, trackers] = await Promise.all([
    getNotebookFacets(),
    getCustomCategories(),
    getNotebookPage(undefined, { take: Number.MAX_SAFE_INTEGER }),
    // Quotes, a tab beside it once you've added them (never public)
    PUBLIC_SITE ? false : quotesEnabled(),
    // each day's tracker answers, at the foot of its pages (never public)
    PUBLIC_SITE ? null : listTrackers(),
  ])
  return (
    <>
      {quotes && <NotebookTabs />}
      <Suspense>
        <NotebookView
          notes={all.notes}
          facets={facets}
          custom={custom}
          trackers={trackers ?? []}
        />
      </Suspense>
    </>
  )
}
