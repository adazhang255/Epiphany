import {
  CHARTS,
  defaultTitle,
  GROUPS,
  MEASURES,
  parseSpec,
  SPLITS,
  type ChartSpec,
} from "@/features/insights/spec"
import {
  HIGHLIGHT_CATEGORIES,
  PURPOSE_NAMES,
  TOPIC_NAMES,
} from "@/features/notes/lib/topics"
import { chatJSON } from "@/features/notes/services/ollama.service"

// A question about the journal, turned into a chart specification by the
// local model (or a chart changed: "make it a line", "only 2025 words").
// Only the spec comes from the model: the browser computes the chart (and
// its numbers) from your entries.

const specSchema = {
  type: "object",
  properties: {
    measure: { type: "string", enum: MEASURES },
    groupBy: { type: "string", enum: GROUPS },
    splitBy: { type: "string", enum: SPLITS },
    chart: { type: "string", enum: CHARTS },
    normalize: { type: "boolean" },
    keywords: { type: "array", items: { type: "string" } },
    filter: {
      type: "object",
      properties: {
        purpose: { type: "string" },
        topic: { type: "string" },
        category: { type: "string" },
        after: { type: "string" },
        before: { type: "string" },
      },
    },
  },
  required: ["measure", "groupBy", "splitBy", "chart", "normalize", "keywords"],
}

function specPrompt() {
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return `You turn a request about someone's journal into a chart specification. Today is ${today}.
Fields:
- measure: "entries" (count of journal entries), "highlights" (count of highlighted passages), "words" (words written), or "mentions" (how many times the keywords appear in the text).
- groupBy (the x-axis): day, week, month, year, weekday, purpose (the entry's category, i.e. why it was written: ${PURPOSE_NAMES.join(", ")}. When the user says "category" they mean this), topic, category (the type of highlight), or keyword (one bar per keyword).
- splitBy (stack or separate by): none, purpose, topic, category, or keyword (one line or colour per keyword). Must differ from groupBy.
- chart: "bar" (default, and for comparing groups), "line" (trends over time), or "area" (shares over time, with normalize).
- normalize: true only when the question is about share, proportion or balance (needs splitBy).
- keywords: specific words, names, people, places or phrases from the request, in lower case (e.g. ["sam", "coffee"]). With measure "mentions" or groupBy/splitBy "keyword" they are counted; otherwise only entries that mention one are included. Use [] when the request names none; for a keyword chart, [] means "their most used words".
- filter (optional) narrows the data, using ONLY these exact names: purpose (${PURPOSE_NAMES.join(", ")}), topic (${TOPIC_NAMES.join(", ")}), category (${HIGHLIGHT_CATEGORIES.join(", ")}). Anything else they name (a person, a word, a feeling not in these lists) goes in keywords, never in filter. To limit dates use filter.after and filter.before as YYYY-MM-DD, both included (e.g. "in 2025" → after "2025-01-01", before "2025-12-31"; "since March" → after the 1st of March); otherwise leave them out.

Examples:
"Is work crowding out my creative life?" -> {"measure":"entries","groupBy":"month","splitBy":"topic","chart":"bar","normalize":true,"keywords":[]}
"Which days of the week do I write most?" -> {"measure":"entries","groupBy":"weekday","splitBy":"none","chart":"bar","normalize":false,"keywords":[]}
"Am I writing more or less lately?" -> {"measure":"words","groupBy":"month","splitBy":"none","chart":"line","normalize":false,"keywords":[]}
"How has the balance of my categories changed?" -> {"measure":"entries","groupBy":"month","splitBy":"purpose","chart":"area","normalize":true,"keywords":[]}
"When do I ask myself questions?" -> {"measure":"highlights","groupBy":"month","splitBy":"none","chart":"line","normalize":false,"keywords":[],"filter":{"category":"Question"}}
"Keyword frequency by keyword over time" -> {"measure":"mentions","groupBy":"month","splitBy":"keyword","chart":"line","normalize":false,"keywords":[]}
"How often do I mention Sam?" -> {"measure":"mentions","groupBy":"month","splitBy":"none","chart":"bar","normalize":false,"keywords":["sam"]}
"Do I write about coffee or tea more?" -> {"measure":"mentions","groupBy":"keyword","splitBy":"none","chart":"bar","normalize":false,"keywords":["coffee","tea"]}
"How much do I write when I mention anxiety?" -> {"measure":"words","groupBy":"month","splitBy":"none","chart":"bar","normalize":false,"keywords":["anxiety"]}
"Entries per week in 2025" -> {"measure":"entries","groupBy":"week","splitBy":"none","chart":"bar","normalize":false,"keywords":[],"filter":{"after":"2025-01-01","before":"2025-12-31"}}

When given a current chart and a change, return the whole chart with only that change made, keeping everything else.`
}

// A filter value the app doesn't have (a person, a word) is what they want
// to find in the text: it becomes a keyword instead of quietly vanishing.
function rescueFilters(raw: Record<string, unknown>) {
  const f = (raw.filter ?? {}) as Record<string, unknown>
  const known: Record<string, readonly string[]> = {
    purpose: PURPOSE_NAMES,
    topic: TOPIC_NAMES,
    category: HIGHLIGHT_CATEGORIES,
  }
  const extra: string[] = []
  // (after / before are dates, checked by parseSpec)
  for (const [key, names] of Object.entries(known)) {
    const value = String(f[key] ?? "").trim()
    if (value && !names.some((n) => n.toLowerCase() === value.toLowerCase()))
      extra.push(value)
  }
  const keywords = Array.isArray(raw.keywords) ? raw.keywords : []
  return { ...raw, keywords: [...keywords, ...extra] }
}

// Years named in the request ("in 2025", "2024 to 2025", "this year", "last
// year"), as a date range: small models often leave the dates out, so a
// range the words plainly give is filled in when the model gave none.
export function datesFromRequest(request: string, now = new Date()) {
  const text = request.toLowerCase()
  const year = now.getFullYear()
  const years = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((m) => +m[1])
  if (/\bthis year\b/.test(text)) years.push(year)
  if (/\blast year\b/.test(text)) years.push(year - 1)
  if (!years.length) return null
  const from = Math.min(...years)
  const to = Math.max(...years)
  // "since 2024": from then on
  if (/\b(since|after|from)\s+(19|20)\d{2}\b/.test(text) && from === to)
    return { after: `${from}-01-01` }
  return { after: `${from}-01-01`, before: `${to}-12-31` }
}

// Keywords only from the request itself (or the chart being changed): small
// models copy words from the examples ("sam", "coffee") into charts that
// never asked for them. Words about the chart ("most interesting keywords")
// aren't keywords either: with none named, the app picks key words from the
// entries.
const META_WORDS = new Set(
  "keyword keywords word words term terms theme themes most top common frequent frequency interesting important main key popular telling notable recurring over time month months week weeks year years chart graph mentions mention".split(
    " ",
  ),
)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
export function groundKeywords(
  keywords: string[],
  request: string,
  current?: ChartSpec,
): string[] {
  return keywords.filter(
    (k) =>
      !META_WORDS.has(k) &&
      (current?.keywords.includes(k) ||
        new RegExp(`(?<![\\p{L}\\p{N}])${escape(k)}`, "iu").test(request)),
  )
}

// When changing a chart, a part the request doesn't mention stays as it was
// (small models "helpfully" change other things too, like turning on %).
const MENTIONS: Partial<Record<keyof ChartSpec, RegExp>> = {
  chart: /\b(line|bar|area|column|chart type)s?\b/i,
  normalize:
    /\b(share|percent(age)?s?|%|proportion|balance|relative|absolute|raw|counts?|numbers)\b|%/i,
  measure:
    /\b(mentions?|count|entries|entry|words?|highlights?|how (often|many|much)|frequency)\b/i,
  groupBy:
    /\b(by|per|over|group(ed)?|axis|daily|weekly|monthly|yearly|weekdays?)\b/i,
  splitBy:
    /\b(split|stack(ed)?|separate|break ?down|by|per|each|compare|colou?rs?|lines?)\b/i,
}
export function keepUnmentioned(
  next: ChartSpec,
  current: ChartSpec,
  request: string,
): ChartSpec {
  const kept: Record<string, unknown> = { ...next }
  for (const [field, re] of Object.entries(MENTIONS))
    if (!re.test(request)) kept[field] = current[field as keyof ChartSpec]
  return parseSpec(kept)
}

// The chart for a request, or `current` changed as asked. Titled from what
// it actually shows, so the title can't promise something the chart isn't.
export async function chartSpecFor(
  request: string,
  current?: ChartSpec,
): Promise<ChartSpec> {
  const ask = current
    ? `Current chart: ${JSON.stringify({ ...current, title: undefined })}\nChange: ${request}`
    : request
  const raw = await chatJSON<Record<string, unknown>>(
    specPrompt(),
    ask,
    specSchema,
    { temperature: 0, model: process.env.OLLAMA_CHART_MODEL },
  )
  let spec = parseSpec(rescueFilters(raw))
  spec = { ...spec, keywords: groundKeywords(spec.keywords, request, current) }
  if (current) spec = keepUnmentioned(spec, current, request)
  const dates = datesFromRequest(request)
  if (dates && !spec.filter.after && !spec.filter.before)
    spec = parseSpec({ ...spec, filter: { ...spec.filter, ...dates } })
  return { ...spec, title: defaultTitle(spec) }
}
