import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  OllamaUnavailableError,
  pickToneModel,
  scoreTone,
} from "@/features/notes/services/ollama.service"

// Fill in the tone score older entries are missing, with the local tone
// model (loaded once for all of them). Entries aren't given a category here:
// that comes from their highlights.
export async function POST() {
  const notes = await prisma.note.findMany({
    where: { sentiment: null },
    select: { id: true, content: true },
  })
  let scored = 0
  try {
    const toneModel = await pickToneModel()
    for (const note of notes) {
      const sentiment = await scoreTone(note.content, toneModel)
      await prisma.note.update({ where: { id: note.id }, data: { sentiment } })
      scored++
    }
  } catch (error) {
    const status = error instanceof OllamaUnavailableError ? 503 : 500
    return NextResponse.json(
      { error: (error as Error).message, classified: scored },
      { status },
    )
  }
  revalidatePath("/", "layout")
  return NextResponse.json({ classified: scored, checked: notes.length })
}
