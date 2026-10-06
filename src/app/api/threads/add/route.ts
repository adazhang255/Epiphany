import { revalidatePath } from "next/cache"
import { addToThread, type ThreadRef } from "@/features/threads/membership"

// Add a passage to a thread: { item, thread }.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const item = typeof body?.item === "string" ? body.item : ""
  const thread = body?.thread as ThreadRef | undefined
  if (!item || !thread?.id || !Array.isArray(thread.memberIds)) {
    return Response.json(
      { error: "Say which highlight and thread" },
      { status: 400 },
    )
  }
  const id = await addToThread(item, thread)
  if (!id) {
    return Response.json(
      { error: "That can't go in this thread" },
      { status: 400 },
    )
  }
  revalidatePath("/threads")
  return Response.json({ ok: true, thread: id })
}
