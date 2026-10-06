import { getThreads, MATCH, type MatchLevel } from "@/features/threads/build"

// Threads, for choosing one to add a highlight to: ?level=close|related|loose
export async function GET(req: Request) {
  const level = new URL(req.url).searchParams.get("level")
  const { threads } = await getThreads(
    level && level in MATCH ? (level as MatchLevel) : "related",
  )
  return Response.json({
    threads: threads.map((t) => ({
      id: t.id,
      kind: t.kind,
      questionId: t.questionId,
      memberIds: t.members.map((m) => m.id),
      title:
        t.title ?? `${t.members[0].quote.split(/\s+/).slice(0, 6).join(" ")}…`,
      size: t.members.length,
    })),
  })
}
