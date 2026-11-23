import { revalidatePath } from "next/cache"
import { mergeThreads, type ThreadRef } from "@/features/threads/membership"
import { offerUndo } from "@/features/undo/undo"
import { cleanThreadName } from "@/features/threads/field"
import {
  getThreadCategories,
  setThreadCategory,
} from "@/features/threads/categories"

// Merge one thread into another: { from, into, name? } (the merged thread's
// name, if you chose one). Undoable. The merged thread keeps `into`'s
// category, or `from`'s.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const from = body?.from as ThreadRef | undefined
  const into = body?.into as ThreadRef | undefined
  const valid = (t?: ThreadRef) => t?.id && Array.isArray(t.memberIds)
  if (!valid(from) || !valid(into)) {
    return Response.json({ error: "Say which two threads" }, { status: 400 })
  }
  const name = body?.name ? cleanThreadName(body.name) : null
  const merged = await mergeThreads(from!, into!, name)
  if (!merged) {
    return Response.json(
      { error: "A question's thread can't be merged" },
      { status: 400 },
    )
  }
  // the merged thread keeps a category (into's, or from's)
  const categories = await getThreadCategories()
  const category = categories[into!.id] ?? categories[from!.id]
  if (category && categories[merged.id] !== category)
    await setThreadCategory(merged.id, category)
  revalidatePath("/threads")
  return Response.json({
    ok: true,
    thread: merged.id,
    undo: offerUndo("Threads merged", merged.restore),
  })
}
