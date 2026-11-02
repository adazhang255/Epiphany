import { prisma } from "@/lib/prisma"
import { createNote } from "@/features/notes/services/notes.service"
import { embed } from "@/features/notes/services/embeddings.service"
import { enqueueAnalysis } from "@/features/notes/services/analysis-queue"
import { syncQuestions } from "@/features/questions/sync"
import { stripInline } from "@/features/notes/lib/markdown"

// A thought written on the Threads page: a new entry (dated now, titled
// later by your local AI) whose whole text is one highlight of yours, of
// type `category`, in thread `thread` (a Quote.thread value; null = none
// yet). Gives the highlight's id.
export async function saveThought(
  text: string,
  category: string,
  thread: string | null = null,
) {
  const note = await createNote({
    title: "",
    content: text,
    category: "",
    tags: "",
    date: new Date(),
  })
  const quote = stripInline(text)
  // embedding is a bonus (threads, Ask); never block on it
  const [vector] = await embed([quote]).catch(() => [] as number[][])
  const highlight = await prisma.quote.create({
    data: {
      noteId: note.id,
      quote,
      category,
      manual: true,
      thread,
      embedding: vector ? JSON.stringify(vector) : null,
    },
  })
  // the rest as for any new entry: questions now, title, tone and topics in
  // the background (your highlight stays)
  await syncQuestions([note.id])
  enqueueAnalysis([note.id])
  return highlight.id
}
