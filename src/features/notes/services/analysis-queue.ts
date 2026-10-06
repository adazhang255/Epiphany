import { runAnalysis } from "@/features/notes/services/analysis"

// Entries waiting to be read by the local model, one at a time, on the
// server. Saving an entry only adds it here, so saving is instant and you can
// leave the page; the header shows progress (see /api/analysis/status).
//
// Kept on globalThis so every route in this server process shares one queue.

type Finished = {
  id: string
  ok: boolean
  count: number
  at: number
  error?: string
}

type QueueState = {
  waiting: { id: string; model?: string; retried?: boolean }[]
  current: string | null
  finished: Finished[]
  running: boolean
  // entries being read right now outside the queue ("Find highlights" on an
  // entry page), so status reports them as busy too
  direct?: string[]
}

const store = globalThis as unknown as { __analysisQueue?: QueueState }
const state: QueueState = (store.__analysisQueue ??= {
  waiting: [],
  current: null,
  finished: [],
  running: false,
})

export function enqueueAnalysis(noteIds: string[], model?: string) {
  for (const id of noteIds) {
    if (state.current === id || state.waiting.some((w) => w.id === id)) continue
    state.waiting.push({ id, model })
  }
  void drain()
}

export function analysisStatus() {
  return {
    pending: [
      ...(state.direct ?? []),
      state.current,
      ...state.waiting.map((w) => w.id),
    ].filter((id): id is string => id !== null),
    finished: state.finished.slice(0, 10),
  }
}

// Run one entry's analysis straight away (not queued), showing as busy in
// the status meanwhile.
export async function runTracked<T>(noteId: string, work: () => Promise<T>) {
  state.direct = [...(state.direct ?? []), noteId]
  try {
    return await work()
  } finally {
    state.direct = state.direct.filter((id) => id !== noteId)
  }
}

export function isAnalysisPending(noteId: string) {
  return state.current === noteId || state.waiting.some((w) => w.id === noteId)
}

async function drain() {
  if (state.running) return
  state.running = true
  try {
    while (state.waiting.length > 0) {
      const next = state.waiting.shift()!
      state.current = next.id
      try {
        const { count } = await runAnalysis(next.id, next.model)
        state.finished.unshift({ id: next.id, ok: true, count, at: Date.now() })
      } catch (error) {
        console.warn("[analysis]", (error as Error).message)
        // Ollama can stall when memory is tight; give it one more go at the end
        if (!next.retried) {
          state.waiting.push({ ...next, retried: true })
          continue
        }
        state.finished.unshift({
          id: next.id,
          ok: false,
          count: 0,
          at: Date.now(),
          error: (error as Error).message,
        })
      }
      state.finished = state.finished.slice(0, 20)
    }
  } finally {
    state.current = null
    state.running = false
  }
}
