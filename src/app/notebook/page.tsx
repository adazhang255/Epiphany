import { Suspense } from "react"
import { NotebookView } from "@/components/NotebookView"
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
  const [facets, custom, all] = await Promise.all([
    getNotebookFacets(),
    getCustomCategories(),
    getNotebookPage(undefined, { take: Number.MAX_SAFE_INTEGER }),
  ])
  return (
    <Suspense>
      <NotebookView notes={all.notes} facets={facets} custom={custom} />
    </Suspense>
  )
}
