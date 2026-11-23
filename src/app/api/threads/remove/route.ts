import { revalidatePath } from "next/cache"
import { removeFromThread, type ThreadRef } from "@/features/threads/membership"
import { offerUndo } from "@/features/undo/undo"

// Take a passage out of a thread: { item, thread }. The entry isn't changed.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const item = typeof body?.item === "string" ? body.item : ""
  const thread = body?.thread as ThreadRef | undefined
  if (!item || !thread?.id) {
    return Response.json(
      { error: "Say which passage and thread" },
      { status: 400 },
    )
  }
  const removed = await removeFromThread(item, thread)
  if (!removed) {
    return Response.json(
      { error: "That one stays in this thread" },
      { status: 400 },
    )
  }
  revalidatePath("/threads")
  return Response.json({
    ok: true,
    // the thread's id now (an automatic one becomes yours)
    thread: removed.thread,
    undo: offerUndo("Removed from the thread", removed.restore),
  })
}
