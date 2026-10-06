import { revalidatePath } from "next/cache"
import { removeFromThread, type ThreadRef } from "@/features/threads/membership"

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
  if (!(await removeFromThread(item, thread))) {
    return Response.json(
      { error: "That one stays in this thread" },
      { status: 400 },
    )
  }
  revalidatePath("/threads")
  return Response.json({ ok: true })
}
