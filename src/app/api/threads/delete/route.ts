import { revalidatePath } from "next/cache"
import { removeThread, type ThreadRef } from "@/features/threads/membership"

// Take a whole thread apart: { thread }. Its highlights and entries stay;
// they're just no longer threaded together.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const thread = body?.thread as ThreadRef | undefined
  if (!thread?.id || !Array.isArray(thread.memberIds)) {
    return Response.json({ error: "Say which thread" }, { status: 400 })
  }
  if (!(await removeThread(thread))) {
    return Response.json(
      { error: "That thread can't be removed" },
      { status: 400 },
    )
  }
  revalidatePath("/threads")
  return Response.json({ ok: true })
}
