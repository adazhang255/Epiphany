import { getNotebookPage } from "@/features/notes/services/notes.service"

// The next few full entries for the Notebook page's endless scroll, with the
// page's filters (uncategorized, category) and topic search.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  return Response.json(
    await getNotebookPage(params.get("cursor") ?? undefined, {
      filter:
        params.get("filter") === "uncategorized" ? "uncategorized" : "all",
      category: params.get("category") ?? undefined,
      q: params.get("q") ?? undefined,
    }),
  )
}
