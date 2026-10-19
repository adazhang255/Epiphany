import { prisma } from "@/lib/prisma"
import { syncQuestions } from "@/features/questions/sync"
import { embed, noteText } from "@/features/notes/services/embeddings.service"
import { saveAnalysis } from "@/features/notes/services/notes.service"
import { analyzeNote } from "@/features/notes/services/ollama.service"
import { scheduleToneFill } from "@/features/notes/services/tone-queue"
import { scheduleTitleFill } from "@/features/notes/services/title-queue"
import { isUntitled } from "@/features/notes/lib/titles"

// Read one entry with the local model and store everything: highlights,
// topics and embeddings. (Its category follows from its highlights.) Tone follows a few
// seconds later from the background tone pass.
export async function runAnalysis(noteId: string, model?: string) {
  const note = await prisma.note.findUnique({ where: { id: noteId } })
  if (!note) throw new Error("Note not found")

  const analysis = await analyzeNote(note.content, model)
  // Embeddings power threads, Ask and answer suggestions, but a missing
  // embedding model shouldn't block saving highlights.
  const vectors = await embed([
    noteText(note.title, note.content),
    ...analysis.highlights.map((h) => h.quote),
  ]).catch((error) => {
    console.warn("[analysis] embedding skipped:", error.message)
    return [] as number[][]
  })
  await saveAnalysis(note.id, {
    ...analysis,
    noteEmbedding: vectors[0],
    highlights: analysis.highlights.map((h, i) => ({
      ...h,
      embedding: vectors[i + 1],
    })),
  })
  await syncQuestions([note.id])
  if (note.sentiment === null) scheduleToneFill()
  if (isUntitled(note.title)) scheduleTitleFill()

  return { count: analysis.highlights.length }
}
