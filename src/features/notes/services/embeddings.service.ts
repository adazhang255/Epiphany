import {
  assertLocalOllama,
  OLLAMA_HOST,
  OllamaUnavailableError,
} from "@/features/notes/services/ollama.service"

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text"

// nomic-embed-text expects a task prefix; "clustering" suits grouping
// passages that say similar things.
const PREFIX = "clustering: "

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  assertLocalOllama()

  let response: Response
  try {
    response = await fetch(`${OLLAMA_HOST}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: texts.map((t) => PREFIX + t),
        keep_alive: "10m",
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
      `Embedding failed (${response.status}). Have you run \`ollama pull ${EMBED_MODEL}\`? ${detail}`,
    )
  }

  const payload = (await response.json()) as { embeddings?: number[][] }
  return payload.embeddings ?? []
}

// What gets embedded for a whole entry: its title and the start of its text
// (long entries are cut so one embedding still captures the gist).
export function noteText(title: string, content: string) {
  return `${title}\n\n${content}`.slice(0, 4000)
}
