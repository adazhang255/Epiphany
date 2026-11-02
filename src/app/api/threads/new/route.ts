import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { cleanCategoryName } from "@/features/notes/lib/topics"
import { cleanThreadName, threadField } from "@/features/threads/field"
import { saveThought } from "@/features/threads/thought"

// Start a thread of your own: { name, text, category? }. Its first thought
// becomes a new entry (see saveThought); add more to it from the page.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const name = cleanThreadName(body?.name)
  const text = typeof body?.text === "string" ? body.text.trim() : ""
  if (!name || !text) {
    return Response.json(
      { error: "Give the thread a name and a first thought" },
      { status: 400 },
    )
  }
  const id = `t-${randomUUID()}`
  await saveThought(
    text,
    cleanCategoryName(body?.category) ?? "Insight",
    threadField(id, name),
  )
  revalidatePath("/", "layout")
  return Response.json({ ok: true, thread: id })
}
