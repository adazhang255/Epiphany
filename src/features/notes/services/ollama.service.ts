import { findQuote } from "@/features/notes/lib/findQuote"
import {
  HIGHLIGHT_CATEGORIES,
  TOPIC_NAMES,
  type TopicName,
} from "@/features/notes/lib/topics"

export type Highlight = {
  quote: string
  category: string
  tags: string[]
}

// No category for the entry as a whole: it comes from its highlights (see
// purposesFromHighlights), so an entry with nothing meaningful stays
// uncategorized instead of being given a guess.
export type NoteAnalysis = {
  sentiment: number | null
  topics: TopicName[]
  tags: string[]
  highlights: Highlight[]
}

export const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434"
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:latest"
// First call after a cold start has to load the model into memory; bigger
// models reading long imports need longer.
const TIMEOUT_MS = 180_000
// Ollama's default context is small and silently truncates long entries.
// 4096 tokens fits a normal entry plus instructions; long texts get 8192.
// A smaller context means less memory (llama3.2: 4.0 GB vs 5.4 GB) and faster
// loads. Only two sizes, so a model is rarely reloaded for a new size.
function contextFor(chars: number) {
  return chars > 9000 ? 8192 : 4096
}

// Journal text must never leave this computer: refuse any Ollama host that
// isn't this machine, even if OLLAMA_HOST is pointed elsewhere.
export function assertLocalOllama() {
  const host = new URL(OLLAMA_HOST).hostname
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new OllamaUnavailableError(
      `Refusing to send your writing to ${host}: OLLAMA_HOST must point at this computer (localhost).`,
    )
  }
}

// Models installed in the local Ollama.
export async function listLocalModels(): Promise<string[]> {
  assertLocalOllama()
  const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null)
  if (!res?.ok) {
    throw new OllamaUnavailableError(
      `Could not reach Ollama at ${OLLAMA_HOST}. Is \`ollama serve\` running?`,
    )
  }
  const data = (await res.json()) as { models?: { name: string }[] }
  return (data.models ?? [])
    .map((m) => m.name)
    .filter((name) => !name.includes("embed"))
}
const MAX_HIGHLIGHTS = 5
// A highlight is 1-3 sentences; MAX_CHARS stands in for "3 sentences" when the
// writing has little punctuation.
const MAX_SENTENCES = 3
const MIN_CHARS = 15
const MAX_CHARS = 400

const CATEGORIES = HIGHLIGHT_CATEGORIES

// Ollama constrains the model's output to this JSON schema ("structured outputs").
// Asked as words (more reliable for small models), stored as -2..2.
const TONES = [
  "very negative",
  "negative",
  "neutral",
  "positive",
  "very positive",
] as const

function toneScore(value: unknown): number | null {
  const i = TONES.indexOf(
    String(value ?? "").toLowerCase() as (typeof TONES)[number],
  )
  return i < 0 ? null : i - 2
}

const analysisSchema = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      items: { type: "string", enum: TOPIC_NAMES },
    },
    highlights: {
      type: "array",
      maxItems: MAX_HIGHLIGHTS,
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
        },
        required: ["quote", "category"],
      },
    },
  },
  required: ["topics", "highlights"],
}

const SYSTEM_PROMPT = `You read a personal journal entry and return JSON describing it.
- topics: the 1 to 3 main topics it is about, chosen ONLY from: ${TOPIC_NAMES.join(", ")}.
- highlights: 0 to ${MAX_HIGHLIGHTS} of the most meaningful passages. Fewer is better than filler. If the entry has nothing meaningful (a greeting, a test, a few stray words), return an empty list. Never invent meaning that isn't there.
  - quote: copied VERBATIM from the entry (same words, same order, never paraphrased), 1 to 3 consecutive sentences.
  - category: what kind of passage it is. Check Writing first:
    - Writing: anything about making creative work. Fiction or poetry (invented characters and scenes, "he"/"she" or named characters rather than the writer's own day), OR advice and notes on the craft and creative process (plot, cliffhangers, endings, pacing, dialogue, characters, ideas for stories, creativity, audiences and feedback on work). "Cliffhangers are key" is Writing.
    - Insight: an idea or lesson about life, people or the world that is not about creative work.
    - Event: something that happened. Emotion: a feeling. Question: something the writer asks or wonders.
    Only include a passage whose category is clear.`

export class OllamaUnavailableError extends Error {}

// Tone is asked in its own small call: small models do far better at one
// focused choice than inside the big analysis request.
const TONE_PROMPT = `Rate the overall feeling of this text, as its writer felt it. tone must be one of: ${TONES.join(", ")}.
Use "very negative" for grief, despair or burnout; "very positive" for elation, pride or deep contentment; "neutral" when it is mostly factual or mixed.`

// Overall tone, -2..2.
export async function scoreTone(content: string, model?: string) {
  const { tone } = await chatJSON<{ tone: string }>(
    TONE_PROMPT,
    content.slice(0, 2000),
    {
      type: "object",
      properties: { tone: { type: "string", enum: TONES } },
      required: ["tone"],
    },
    { temperature: 0, model },
  )
  return toneScore(tone)
}

// Tone model: OLLAMA_TONE_MODEL, else gemma3:4b if installed. On the demo
// entries it got the direction of every clear-cut entry right (16/16) where
// llama3.2 got 12, e.g. rating a grandmother's death "very positive".
export async function pickToneModel() {
  const installed = await listLocalModels()
  for (const name of [process.env.OLLAMA_TONE_MODEL, "gemma3:4b"]) {
    if (name && installed.includes(name)) return name
  }
  return OLLAMA_MODEL
}

// Model for the category/tone backfill: OLLAMA_TAG_MODEL, else the default
// (llama3.2 scored best on the demo entries with the prompt above).
export async function pickTagModel() {
  const installed = await listLocalModels()
  const wanted = process.env.OLLAMA_TAG_MODEL
  return wanted && installed.includes(wanted) ? wanted : OLLAMA_MODEL
}

// On a 16 GB Mac two chat models loaded at once can exhaust memory and stall
// Ollama for minutes, so unload any other chat model before using this one.
// (Small embedding models are left alone.)
async function unloadOtherModels(model: string) {
  const res = await fetch(`${OLLAMA_HOST}/api/ps`, {
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null)
  if (!res?.ok) return
  const { models = [] } = (await res.json()) as { models?: { name: string }[] }
  const others = models.filter(
    (m) =>
      !m.name.includes("embed") &&
      m.name !== model &&
      `${m.name}:latest` !== model &&
      m.name !== `${model}:latest`,
  )
  await Promise.all(
    others.map((m) =>
      fetch(`${OLLAMA_HOST}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: m.name, keep_alive: 0 }),
      }).catch(() => null),
    ),
  )
}

// One structured-output chat call: the reply is constrained to `schema` and
// parsed as JSON (an unparseable reply comes back as {}).
export async function chatJSON<T>(
  system: string,
  user: string,
  schema: object,
  {
    temperature = 0.2,
    model = OLLAMA_MODEL,
  }: { temperature?: number; model?: string } = {},
): Promise<Partial<T>> {
  assertLocalOllama()
  await unloadOtherModels(model || OLLAMA_MODEL)
  let response: Response
  try {
    response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: model || OLLAMA_MODEL,
        stream: false,
        keep_alive: "10m",
        format: schema,
        options: {
          temperature,
          num_ctx: contextFor(system.length + user.length),
        },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    })
  } catch (error) {
    throw new OllamaUnavailableError(
      `Could not reach Ollama at ${OLLAMA_HOST}. Is \`ollama serve\` running? (${(error as Error).message})`,
    )
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new OllamaUnavailableError(
      `Ollama returned ${response.status}: ${detail}`,
    )
  }

  const payload = (await response.json()) as { message?: { content?: string } }
  try {
    return JSON.parse(payload.message?.content ?? "{}")
  } catch {
    return {}
  }
}

// Highlights, topics, tags and (unless already set) the category, all with
// one model so nothing is swapped while you wait. Tone is filled in later by
// the background pass in tone-queue.ts, which loads its model once for many
// entries.
export async function analyzeNote(
  content: string,
  model?: string,
): Promise<NoteAnalysis> {
  const parsed = await chatJSON<{
    topics: unknown
    highlights: unknown
  }>(SYSTEM_PROMPT, content, analysisSchema, { model })

  const topics = cleanTopics(parsed.topics)
  // tags aren't used any more: none are asked for or stored
  const tags: string[] = []
  const sentiment = null

  return {
    sentiment,
    topics,
    tags,
    highlights: keepVerbatim(
      content,
      Array.isArray(parsed.highlights) ? parsed.highlights : [],
    ),
  }
}

function cleanTopics(value: unknown): TopicName[] {
  if (!Array.isArray(value)) return []
  const topics = TOPIC_NAMES.filter((name) =>
    value.some((v) => String(v).toLowerCase() === name.toLowerCase()),
  )
  return topics.slice(0, 3)
}

// Shorten a verbatim passage to at most MAX_SENTENCES sentences / MAX_CHARS.
// Cutting the end off a verbatim passage keeps it verbatim.
function clampLength(quote: string) {
  const ends = [...quote.matchAll(/[.!?]+["”’)]*(?=\s|$)/g)].map(
    (m) => m.index + m[0].length,
  )
  let cut = quote.length
  if (ends.length > MAX_SENTENCES) {
    cut = ends[MAX_SENTENCES - 1]
  }
  if (cut > MAX_CHARS) {
    const lastSentence = ends.filter((e) => e <= MAX_CHARS).at(-1)
    cut = lastSentence ?? quote.lastIndexOf(" ", MAX_CHARS)
  }
  return quote.slice(0, cut > 0 ? cut : MAX_CHARS).trim()
}

// Drop anything the model invented: a highlight must exist in the note so the
// note page can mark it. Returns the note's own wording, not the model's.
function keepVerbatim(content: string, highlights: unknown[]) {
  const seen = new Set<string>()
  const kept: Highlight[] = []

  for (const item of highlights) {
    const highlight = item as Partial<Record<keyof Highlight, unknown>>
    if (typeof highlight?.quote !== "string") {
      continue
    }
    const range = findQuote(content, highlight.quote)
    if (!range) {
      continue
    }
    const quote = clampLength(content.slice(range.start, range.end))
    if (quote.length < MIN_CHARS || seen.has(quote)) {
      continue
    }
    seen.add(quote)
    const category = CATEGORIES.find(
      (c) => c.toLowerCase() === String(highlight.category).toLowerCase(),
    )
    kept.push({
      quote,
      category: category ?? "Insight",
      tags: [],
    })
  }

  return kept.slice(0, MAX_HIGHLIGHTS)
}

// Model for conversation (Ask your journal): OLLAMA_ASK_MODEL, else the
// better small conversational model if installed, else the default.
export async function pickAskModel() {
  const installed = await listLocalModels()
  for (const name of [process.env.OLLAMA_ASK_MODEL, "gemma3:4b"]) {
    if (name && installed.includes(name)) return name
  }
  return OLLAMA_MODEL
}

// Streaming chat with the local model: yields text as it is generated.
// Aborting `signal` (e.g. the person pressed Stop) ends generation in Ollama.
export async function* chatStream(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  {
    model = OLLAMA_MODEL,
    temperature = 0.5,
    signal,
  }: { model?: string; temperature?: number; signal?: AbortSignal } = {},
) {
  assertLocalOllama()
  await unloadOtherModels(model)
  let response: Response
  try {
    response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
        : AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model,
        stream: true,
        keep_alive: "10m",
        options: {
          temperature,
          num_ctx: contextFor(
            messages.reduce((n, m) => n + m.content.length, 0),
          ),
        },
        messages,
      }),
    })
  } catch (error) {
    throw new OllamaUnavailableError(
      `Could not reach Ollama at ${OLLAMA_HOST}. Is \`ollama serve\` running? (${(error as Error).message})`,
    )
  }
  if (!response.ok || !response.body) {
    throw new OllamaUnavailableError(
      `Ollama returned ${response.status}: ${await response.text()}`,
    )
  }

  // Ollama streams one JSON object per line
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      const chunk = JSON.parse(line) as {
        message?: { content?: string }
        done?: boolean
      }
      if (chunk.message?.content) yield chunk.message.content
      if (chunk.done) return
    }
  }
}

// Tool model for Ask's tool calls: OLLAMA_TOOL_MODEL, else llama3.2, which
// supports tool calling (gemma3 does not).
export async function pickToolModel() {
  const installed = await listLocalModels()
  for (const name of [
    process.env.OLLAMA_TOOL_MODEL,
    "llama3.2:latest",
    "qwen3:4b",
    "qwen2.5:7b",
  ]) {
    if (name && installed.includes(name)) return name
  }
  return OLLAMA_MODEL
}

export type ToolCall = {
  function: { name: string; arguments: Record<string, unknown> }
}

export type ToolChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_name: string }

// One tool-calling step: the model either asks for tools or answers in text.
export async function chatTools(
  messages: ToolChatMessage[],
  tools: object[],
  {
    model = OLLAMA_MODEL,
    signal,
  }: { model?: string; signal?: AbortSignal } = {},
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  assertLocalOllama()
  await unloadOtherModels(model)
  let response: Response
  try {
    response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
        : AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: "10m",
        options: {
          temperature: 0,
          num_ctx: contextFor(
            messages.reduce((n, m) => n + m.content.length, 0),
          ),
        },
        messages,
        tools,
      }),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new OllamaUnavailableError(
      `Could not reach Ollama at ${OLLAMA_HOST}. Is \`ollama serve\` running? (${(error as Error).message})`,
    )
  }
  if (!response.ok) {
    throw new OllamaUnavailableError(
      `Ollama returned ${response.status}: ${await response.text()}`,
    )
  }
  const payload = (await response.json()) as {
    message?: { content?: string; tool_calls?: ToolCall[] }
  }
  return {
    content: payload.message?.content ?? "",
    toolCalls: payload.message?.tool_calls ?? [],
  }
}
