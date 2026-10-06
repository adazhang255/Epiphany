// Find the sentences in an entry that ask or wonder something. A fixed rule
// (not the AI), so it's instant and never misses one:
// - "question": the sentence contains a question mark
// - "wondering": it hedges or wonders ("perhaps", "maybe", "I wonder"…)

export type FoundQuestion = { text: string; kind: "question" | "wondering" }

const WONDERING =
  /\b(perhaps|maybe|i wonder|wonder (?:if|whether|why|how|what)|what if|should i|could i|would it|not sure|unsure|i don'?t know|i do not know|uncertain|might be|i'?m torn|or is it)\b/i

const MIN_CHARS = 6
const MAX_CHARS = 400

export function extractQuestions(content: string): FoundQuestion[] {
  const sentences = content
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?…])["”’)]*\s+/))
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((s) => s.length >= MIN_CHARS && s.length <= MAX_CHARS)

  const seen = new Set<string>()
  const found: FoundQuestion[] = []
  for (const text of sentences) {
    if (seen.has(text)) continue
    const kind = text.includes("?")
      ? "question"
      : WONDERING.test(text)
        ? "wondering"
        : null
    if (!kind) continue
    seen.add(text)
    found.push({ text, kind })
  }
  return found
}
