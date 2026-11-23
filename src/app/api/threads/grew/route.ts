import { getThreads } from "@/features/threads/build"
import { grownThreads } from "@/features/threads/grew"

// How many threads grew since ?since=… (milliseconds), for the count beside
// Threads in the nav.
export async function GET(req: Request) {
  const since = Number(new URL(req.url).searchParams.get("since"))
  if (!Number.isFinite(since) || since <= 0) return Response.json({ grew: 0 })
  const { threads } = await getThreads()
  return Response.json({ grew: grownThreads(threads, since).size })
}
