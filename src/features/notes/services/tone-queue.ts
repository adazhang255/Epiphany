import { prisma } from "@/lib/prisma"
import {
  pickToneModel,
  scoreTone,
} from "@/features/notes/services/ollama.service"

// Tone uses a different model (gemma3:4b) from the rest of the analysis.
// Loading it for every save meant swapping models in and out of memory each
// time (about 24 s per entry), so tones are filled in here instead: a few
// seconds after the last save or import, one pass loads the tone model once
// and scores every entry that still needs a tone.

const QUIET_MS = 4000

// Kept on globalThis so every route in this server process shares one pass.
type ToneState = {
  timer: ReturnType<typeof setTimeout> | null
  running: boolean
  again: boolean
}
const store = globalThis as unknown as { __toneQueue?: ToneState }
const state: ToneState = (store.__toneQueue ??= {
  timer: null,
  running: false,
  again: false,
})

export function scheduleToneFill() {
  if (state.timer) clearTimeout(state.timer)
  state.timer = setTimeout(run, QUIET_MS)
}

// True while entries are still waiting for highlights. The tone pass waits
// for that queue to empty, so the two models never take turns evicting each
// other in the middle of a batch. (Read from the shared global rather than
// imported, to avoid a circular import with analysis-queue.)
function analysisBusy() {
  const queue = (
    globalThis as {
      __analysisQueue?: { current: string | null; waiting: unknown[] }
    }
  ).__analysisQueue
  return Boolean(queue && (queue.current || queue.waiting.length > 0))
}

async function run() {
  state.timer = null
  if (analysisBusy()) {
    scheduleToneFill()
    return
  }
  if (state.running) {
    state.again = true
    return
  }
  state.running = true
  try {
    const waiting = await prisma.note.findMany({
      where: { sentiment: null },
      select: { id: true, content: true },
    })
    if (waiting.length > 0) {
      const model = await pickToneModel()
      for (const note of waiting) {
        // new work arrived mid-pass: let it have the GPU, finish later
        if (state.timer || analysisBusy()) {
          scheduleToneFill()
          break
        }
        const sentiment = await scoreTone(note.content, model)
        await prisma.note.update({
          where: { id: note.id },
          data: { sentiment },
        })
      }
    }
  } catch (error) {
    // Ollama may be off; the next save (or Stats → Fill them in) retries
    console.warn("[tone]", (error as Error).message)
  } finally {
    state.running = false
    if (state.again) {
      state.again = false
      scheduleToneFill()
    }
  }
}
