import { revalidatePath } from "next/cache"
import { runUndo } from "@/features/undo/undo"

// Undo a delete: { token } (from the delete's response).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const token = typeof body?.token === "string" ? body.token : ""
  const label = token ? await runUndo(token).catch(() => undefined) : null
  if (label === undefined)
    return Response.json({ error: "Couldn't put it back." }, { status: 500 })
  if (!label)
    return Response.json(
      { error: "Too late to undo that (or it was already undone)." },
      { status: 410 },
    )
  revalidatePath("/", "layout")
  return Response.json({ ok: true, restored: label })
}
