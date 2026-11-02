import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { addToThread, type ThreadRef } from "@/features/threads/membership"
import { highlightType } from "@/features/notes/lib/topics"
import { saveThought } from "@/features/threads/thought"

// A new thought added straight to a thread: { text, thread }. It becomes a
// new entry whose whole text is one highlight of yours, in that thread (see
// saveThought). Its type is the thread's most common one (Insight in a
// question's thread, as an answer to it).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const text = typeof body?.text === "string" ? body.text.trim() : ""
  const thread = body?.thread as ThreadRef | undefined
  if (!text || !thread?.id || !Array.isArray(thread.memberIds)) {
    return Response.json(
      { error: "Write something, and say which thread" },
      { status: 400 },
    )
  }

  let category = "Insight"
  if (thread.kind !== "qa") {
    const members = await prisma.quote.findMany({
      where: {
        id: { in: thread.memberIds.filter((id) => !id.startsWith("q-")) },
      },
      select: { category: true },
    })
    const counts = new Map<string, number>()
    for (const m of members) {
      const type = highlightType(m.category)
      counts.set(type, (counts.get(type) ?? 0) + 1)
    }
    category = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? category
  }

  const highlight = await saveThought(text, category)
  const id = await addToThread(highlight, thread)
  revalidatePath("/", "layout")
  return Response.json({ ok: true, thread: id ?? thread.id })
}
