import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { embed, noteText } from "@/features/notes/services/embeddings.service"
import {
  getUnembeddedNotes,
  getUnembeddedQuotes,
  setEmbeddings,
  setNoteEmbeddings,
} from "@/features/notes/services/notes.service"

const BATCH = 32

// Embeds every highlight and entry that doesn't have an embedding yet.
export async function POST() {
  try {
    const quotes = await getUnembeddedQuotes()
    for (let i = 0; i < quotes.length; i += BATCH) {
      const batch = quotes.slice(i, i + BATCH)
      const vectors = await embed(batch.map((q) => q.quote))
      await setEmbeddings(
        batch.map((q, j) => ({ id: q.id, embedding: vectors[j] })),
      )
    }
    const notes = await getUnembeddedNotes()
    for (let i = 0; i < notes.length; i += BATCH) {
      const batch = notes.slice(i, i + BATCH)
      const vectors = await embed(
        batch.map((n) => noteText(n.title, n.content)),
      )
      await setNoteEmbeddings(
        batch.map((n, j) => ({ id: n.id, embedding: vectors[j] })),
      )
    }
    revalidatePath("/threads")
    revalidatePath("/")
    return NextResponse.json({ count: quotes.length + notes.length })
  } catch (error) {
    console.error("[embeddings]", error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 503 },
    )
  }
}
