import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { removeDuplicates } from "@/features/notes/services/notes.service"

// Remove duplicate entries (same text, same date), keeping one of each.
// Optional body: { keep: [noteId, ...] } to choose which copy survives.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const keep = Array.isArray(body?.keep)
    ? body.keep.filter((id: unknown): id is string => typeof id === "string")
    : []
  const removed = await removeDuplicates(keep)
  revalidatePath("/", "layout")
  return NextResponse.json({ removed })
}
