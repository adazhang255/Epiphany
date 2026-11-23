import { revalidatePath } from "next/cache"
import { addToThread, type ThreadRef } from "@/features/threads/membership"

// Add passages to a thread: { items, thread } (or { item, thread } for one).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const list: unknown[] = Array.isArray(body?.items) ? body.items : [body?.item]
  const items = [
    ...new Set(
      list.filter((x): x is string => typeof x === "string" && x !== ""),
    ),
  ]
  const thread = body?.thread as ThreadRef | undefined
  if (items.length === 0 || !thread?.id || !Array.isArray(thread.memberIds)) {
    return Response.json(
      { error: "Say which highlights and thread" },
      { status: 400 },
    )
  }
  const id = await addToThread(items, thread)
  if (!id) {
    return Response.json(
      { error: "Those can't go in this thread" },
      { status: 400 },
    )
  }
  revalidatePath("/threads")
  return Response.json({ ok: true, thread: id })
}
