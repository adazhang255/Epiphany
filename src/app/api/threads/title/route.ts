import { titleThread } from "@/features/threads/titles"

// A thread's title, from the local model (cached): ?ids=quoteId,quoteId,…
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, 20)
  if (ids.length < 2) {
    return Response.json(
      { error: "Give the thread's highlights" },
      { status: 400 },
    )
  }
  try {
    return Response.json({ title: await titleThread(ids) })
  } catch {
    // Ollama off or busy: the page keeps its placeholder
    return Response.json({ title: null })
  }
}
