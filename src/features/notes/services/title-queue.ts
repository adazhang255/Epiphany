import { prisma } from "@/lib/prisma"
import { chatJSON } from "@/features/notes/services/ollama.service"
import { markAutoTitle, UNTITLED } from "@/features/notes/lib/titles"

// Temporary titles for entries left untitled, written by the local model in
// the background (one at a time, after highlights are found, so the two
// never compete for memory) and saved as the entry's title, marked as
// generated so the app shows them in grey. An entry you name in the
// meantime keeps your title.

const QUIET_MS = 5000
const READ_CHARS = 1500

type TitleState = {
  timer: ReturnType<typeof setTimeout> | null
  running: boolean
  again: boolean
}
const store = globalThis as unknown as { __titleQueue?: TitleState }
const state: TitleState = (store.__titleQueue ??= {
  timer: null,
  running: false,
  again: false,
})

export function scheduleTitleFill(delay = QUIET_MS) {
  if (state.timer) clearTimeout(state.timer)
  state.timer = setTimeout(run, delay)
}

// (read from the shared global, like the tone pass, to avoid an import cycle)
function analysisBusy() {
  const queue = (
    globalThis as {
      __analysisQueue?: { current: string | null; waiting: unknown[] }
    }
  ).__analysisQueue
  return Boolean(queue && (queue.current || queue.waiting.length > 0))
}

const PROMPT = `Give this journal entry a short title: 2 to 6 words, in the writer's own terms, about what it is mostly about. No quotes, no date, no ending punctuation.`
const schema = {
  type: "object",
  properties: { title: { type: "string" } },
  required: ["title"],
}

export function cleanTitle(raw: unknown) {
  return String(raw ?? "")
    .replace(/^["“'‘\s]+|["”'’\s.!:;,]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim()
    .replace(/^\p{Ll}/u, (c) => c.toUpperCase())
}

async function run() {
  state.timer = null
  if (analysisBusy()) return scheduleTitleFill()
  if (state.running) {
    state.again = true
    return
  }
  state.running = true
  try {
    const waiting = await prisma.note.findMany({
      where: { title: { in: UNTITLED } },
      select: { id: true, content: true },
      orderBy: { date: "desc" },
    })
    for (const note of waiting) {
      if (!note.content.trim()) continue
      // highlights come first: stop and pick up again once they're done
      if (analysisBusy()) return scheduleTitleFill()
      try {
        const reply = await chatJSON<{ title: string }>(
          PROMPT,
          note.content.slice(0, READ_CHARS),
          schema,
          { temperature: 0.2 },
        )
        const title = cleanTitle(reply.title)
        if (!title) continue
        // only if it's still untitled (you may have named it meanwhile)
        await prisma.note.updateMany({
          where: { id: note.id, title: { in: UNTITLED } },
          data: { title: markAutoTitle(title) },
        })
      } catch (error) {
        console.warn("[titles]", (error as Error).message)
        break // Ollama isn't answering: try again after the next save
      }
    }
  } finally {
    state.running = false
    if (state.again) {
      state.again = false
      scheduleTitleFill()
    }
  }
}
