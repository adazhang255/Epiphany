import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { keepThread, type ThreadRef } from "@/features/threads/membership"
import { setStarred, THREAD_STARS } from "@/features/notes/stars"

// Star a thread as a favourite, or take its star off: { thread, starred }.
// An automatic thread is kept as one you arranged first, so its passages
// (and the star) stay together. Gives the thread's id.
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  const thread = body?.thread as ThreadRef | undefined
  if (
    typeof body?.starred !== "boolean" ||
    !thread?.id ||
    !Array.isArray(thread.memberIds)
  )
    return NextResponse.json(
      { error: "thread, and starred: true or false" },
      { status: 400 },
    )
  const id = body.starred ? await keepThread(thread) : thread.id
  await setStarred(id, body.starred, THREAD_STARS)
  revalidatePath("/threads")
  return NextResponse.json({ starred: body.starred, thread: id })
}
