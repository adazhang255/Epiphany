import { revalidatePath } from "next/cache"
import { cleanThreadName } from "@/features/threads/field"
import { renameThread, type ThreadRef } from "@/features/threads/membership"

// Name a thread: { thread, name }. An empty name goes back to the automatic
// title.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const thread = body?.thread as ThreadRef | undefined
  if (!thread?.id || !Array.isArray(thread.memberIds)) {
    return Response.json({ error: "Say which thread" }, { status: 400 })
  }
  const id = await renameThread(thread, cleanThreadName(body?.name))
  if (!id) {
    return Response.json(
      { error: "A question's thread is titled by its question" },
      { status: 400 },
    )
  }
  revalidatePath("/threads")
  // the thread's id now (an automatic one becomes yours)
  return Response.json({ ok: true, thread: id })
}
