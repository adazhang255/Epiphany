import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { deleteSavedChart } from "@/features/notes/services/notes.service"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    await deleteSavedChart(id)
  } catch {
    return NextResponse.json({ error: "Chart not found" }, { status: 404 })
  }
  revalidatePath("/custom")
  return NextResponse.json({ ok: true })
}
