import { searchTopic } from "@/features/search/topic"

// Topic search for the pages, which filter in the browser: ?q=… gives the
// matching entries (best first), the highlights that match by themselves, and
// whether matching by meaning was possible.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? ""
  const found = await searchTopic(q)
  return Response.json({
    noteIds: found.entries.map((e) => e.noteId),
    highlightIds: [...found.highlightIds],
    byMeaning: found.byMeaning,
  })
}
