import { findQuote } from "@/features/notes/lib/findQuote"
import { chatJSON } from "@/features/notes/services/ollama.service"
import { splitOnMarkers, type Segment } from "@/features/import/split"

export type ProposedEntry = {
  title: string
  date: string | null // YYYY-MM-DD
  dateFrom: "document" | "ai" | null
  content: string
}

// How much text the model reads at once to find where entries start. Small
// local models list only the first several breaks in a long stretch, so each
// read is short, and the next one starts at the last break found.
const SPLIT_WINDOW = 6_000
// when a read finds no break, the next one still overlaps it by this much
const SPLIT_OVERLAP = 1_000
// most reads for one document (6 000 characters each, so ~1.2 MB)
const MAX_SPLIT_READS = 200
// Shorter than this, a document without headings or dates is one entry.
const MIN_SPLIT_CHARS = 600
const META_PREVIEW = 700

const splitSchema = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          firstWords: { type: "string" },
        },
        required: ["firstWords"],
      },
    },
  },
  required: ["entries"],
}

const SPLIT_PROMPT = `You are given text from a document that may contain many separate journal entries or notes written at different times: often 5, 10, 20 or more.
Find where EVERY separate entry begins, in order, from the first to the very last one in the text. Don't stop early: go through to the end. A new entry often starts with a new day or time ("Today", "This morning", a date), a change of subject, or a new paragraph.
For each entry, copy its first 6 to 10 words EXACTLY as written (firstWords).
If the whole text is a single entry, return just one item with its first words. Do not summarise or rewrite anything.`

// One entry per call with a flat schema: small local models handle this far
// more reliably than a batch (they tend to return an empty list).
const metaSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    date: { type: "string" },
  },
  required: ["title", "date"],
}

function metaPrompt(year: number) {
  return `For this journal entry, give:
- title: a short title of 2 to 6 words, in the writer's own terms. No quotes.
- date: the date the entry was written as YYYY-MM-DD, only if the text states it (e.g. a date line or "today is June 3"). Otherwise "". Never guess from words like "today" or "tonight". If a month and day are given without a year, use ${year}.`
}

const DATE_MENTION =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b/i

function mentionsDate(text: string) {
  return DATE_MENTION.test(text)
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null
  const d = new Date(`${value}T00:00`)
  const year = d.getFullYear()
  return !Number.isNaN(d.getTime()) &&
    year >= 1900 &&
    d <= new Date(Date.now() + 86_400_000)
    ? value
    : null
}

// Ask the model where entries start, then cut the original text at those
// points. Text is always cut from the document itself, never retyped. Each
// read starts at the last entry found, so however few breaks the model
// lists at a time, it keeps going until the end of the document.
async function aiSplit(text: string, model: string): Promise<Segment[]> {
  const starts = new Set<number>([0])
  // written in lines or paragraphs (not one unbroken block)
  const lined = text.includes("\n")
  let offset = 0
  for (let read = 0; read < MAX_SPLIT_READS && offset < text.length; read++) {
    const window = text.slice(offset, offset + SPLIT_WINDOW)
    const { entries } = await chatJSON<{ entries: { firstWords: string }[] }>(
      SPLIT_PROMPT,
      window,
      splitSchema,
      { temperature: 0, model },
    )
    let last = offset
    for (const entry of entries ?? []) {
      const range = findQuote(window, String(entry.firstWords ?? ""))
      if (!range) continue
      // entries start on a new line: a break the model saw mid-paragraph
      // belongs at the start of that paragraph (one that's already there)
      const at = lined
        ? text.lastIndexOf("\n", offset + range.start - 1) + 1
        : offset + range.start
      starts.add(at)
      last = Math.max(last, at)
    }
    // read on from the last entry found, or past this stretch if none was
    // (the whole stretch belongs to the entry before it)
    offset = last > offset ? last : offset + SPLIT_WINDOW - SPLIT_OVERLAP
  }
  const sorted = [...starts].sort((a, b) => a - b)
  return sorted
    .map((start, i) => ({
      heading: null,
      date: null,
      content: text.slice(start, sorted[i + 1] ?? text.length).trim(),
    }))
    .filter((s) => s.content.length > 0)
}

export async function proposeEntries(
  text: string,
  model: string,
  onlyOne = false,
): Promise<ProposedEntry[]> {
  const clean = text.trim()
  if (!clean) return []

  let segments = onlyOne
    ? [{ heading: null, date: null, content: clean }]
    : splitOnMarkers(clean)
  if (!onlyOne && segments.length < 2 && clean.length > MIN_SPLIT_CHARS) {
    segments = await aiSplit(clean, model)
  }

  // A title and date for each entry.
  const year = new Date().getFullYear()
  const meta = new Map<number, { title: string; date: string | null }>()
  for (const [i, segment] of segments.entries()) {
    if (segment.heading && segment.date) continue
    const reply = await chatJSON<{ title: string; date: string }>(
      metaPrompt(year),
      `${segment.heading ? `Heading: ${segment.heading}\n\n` : ""}${segment.content.slice(0, META_PREVIEW)}`,
      metaSchema,
      { temperature: 0.1, model },
    )
    meta.set(i, {
      title: String(reply.title ?? "")
        .replace(/^["“]|["”]$/g, "")
        .trim()
        .slice(0, 80),
      // only trust a date the text actually mentions
      date: mentionsDate(segment.content.slice(0, META_PREVIEW))
        ? validDate(reply.date)
        : null,
    })
  }

  return segments.map((segment, i) => {
    const ai = meta.get(i)
    const date = segment.date ?? ai?.date ?? null
    return {
      title: capitalize(segment.heading || ai?.title || "Untitled thought"),
      date,
      dateFrom: segment.date ? "document" : date ? "ai" : null,
      content: segment.content,
    }
  })
}
