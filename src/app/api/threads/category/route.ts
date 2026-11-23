import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { cleanCategoryName } from "@/features/notes/lib/topics"
import { keepThread, type ThreadRef } from "@/features/threads/membership"
import { setThreadCategory } from "@/features/threads/categories"

// Give a thread a category, like a highlight's: { thread, category } (a
// built-in type or a name of your own; null takes it off). An automatic
// thread is kept as one you arranged first, so the category stays with its
// passages. Gives the thread's id.
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  const thread = body?.thread as ThreadRef | undefined
  if (!thread?.id || !Array.isArray(thread.memberIds))
    return NextResponse.json({ error: "Say which thread" }, { status: 400 })
  const category =
    body?.category === null ? null : cleanCategoryName(body?.category)
  if (body?.category !== null && !category)
    return NextResponse.json({ error: "Name a category" }, { status: 400 })
  const id = category ? await keepThread(thread) : thread.id
  await setThreadCategory(id, category)
  revalidatePath("/threads")
  return NextResponse.json({ thread: id, category })
}
