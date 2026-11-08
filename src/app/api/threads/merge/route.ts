import { revalidatePath } from "next/cache"
import { mergeThreads, type ThreadRef } from "@/features/threads/membership"
import { offerUndo } from "@/features/undo/undo"

// Merge one thread into another: { from, into }. Undoable.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const from = body?.from as ThreadRef | undefined
  const into = body?.into as ThreadRef | undefined
  const valid = (t?: ThreadRef) => t?.id && Array.isArray(t.memberIds)
  if (!valid(from) || !valid(into)) {
    return Response.json({ error: "Say which two threads" }, { status: 400 })
  }
  const merged = await mergeThreads(from!, into!)
  if (!merged) {
    return Response.json(
      { error: "A question's thread can't be merged" },
      { status: 400 },
    )
  }
  revalidatePath("/threads")
  return Response.json({
    ok: true,
    thread: merged.id,
    undo: offerUndo("Threads merged", merged.restore),
  })
}
