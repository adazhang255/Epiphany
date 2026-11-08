import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { cleanThreadName } from "@/features/threads/field"
import { startThread } from "@/features/threads/membership"

// Start a thread from a highlight (or a question, "q-" + id): { item, name }.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const item = typeof body?.item === "string" ? body.item : ""
  const name = cleanThreadName(body?.name)
  if (!item || !name) {
    return Response.json(
      { error: "Name the thread, and say which highlight starts it" },
      { status: 400 },
    )
  }
  const exists = item.startsWith("q-")
    ? await prisma.question.findUnique({ where: { id: item.slice(2) } })
    : await prisma.quote.findUnique({ where: { id: item } })
  if (!exists) {
    return Response.json({ error: "That highlight is gone" }, { status: 404 })
  }
  const thread = await startThread(item, name)
  revalidatePath("/threads")
  return Response.json({ ok: true, thread })
}
