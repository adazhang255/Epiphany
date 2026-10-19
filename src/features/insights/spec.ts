import {
  HIGHLIGHT_CATEGORIES,
  PURPOSE_NAMES,
  TOPIC_NAMES,
} from "@/features/notes/lib/topics"
import { cleanKeywords } from "@/features/insights/keywords"

// A chart is described by this small spec. The builder edits it by hand, the
// AI fills it in from a question, and compute() turns it into numbers, so
// the model never makes up data.
export const MEASURES = ["entries", "highlights", "words", "mentions"] as const
export const GROUPS = [
  "day",
  "week",
  "month",
  "year",
  "weekday",
  "purpose",
  "topic",
  "category",
  "keyword",
] as const
export const SPLITS = [
  "none",
  "purpose",
  "topic",
  "category",
  "keyword",
] as const
export const CHARTS = ["bar", "line", "area"] as const

export type ChartSpec = {
  title: string
  measure: (typeof MEASURES)[number]
  groupBy: (typeof GROUPS)[number]
  splitBy: (typeof SPLITS)[number]
  chart: (typeof CHARTS)[number]
  // show each split as a share of its column instead of a count
  normalize: boolean
  // after / before: YYYY-MM-DD, both days included
  filter: {
    purpose?: string
    topic?: string
    category?: string
    after?: string
    before?: string
  }
  // words or phrases: counted ("mentions", or grouped/split by keyword), or
  // else only entries that mention one of them are included. None, where
  // they're counted: the most written words, picked from the entries.
  keywords: string[]
}

// whether the chart counts or compares its keywords (not just filters by them)
export const keywordAxis = (
  spec: Pick<ChartSpec, "measure" | "groupBy" | "splitBy">,
) =>
  spec.measure === "mentions" ||
  spec.groupBy === "keyword" ||
  spec.splitBy === "keyword"

export const MEASURE_LABEL: Record<ChartSpec["measure"], string> = {
  entries: "Entries",
  highlights: "Highlights",
  words: "Words written",
  mentions: "Keyword mentions",
}

export const GROUP_LABEL: Record<ChartSpec["groupBy"], string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
  weekday: "Day of the week",
  purpose: "Category",
  topic: "Topic",
  category: "Highlight type",
  keyword: "Keyword",
}

export const SPLIT_LABEL: Record<ChartSpec["splitBy"], string> = {
  none: "Nothing",
  purpose: "Category",
  topic: "Topic",
  category: "Highlight type",
  keyword: "Keyword",
}

export function defaultTitle(spec: Omit<ChartSpec, "title">) {
  const parts = [
    `${MEASURE_LABEL[spec.measure]} by ${GROUP_LABEL[spec.groupBy].toLowerCase()}`,
  ]
  if (spec.splitBy !== "none") {
    parts.push(
      `${spec.normalize ? "share " : ""}split by ${SPLIT_LABEL[spec.splitBy].toLowerCase()}`,
    )
  }
  const { purpose, topic, category } = spec.filter
  const filters = [purpose, topic, category].filter(Boolean)
  if (filters.length) parts.push(`only ${filters.join(", ")}`)
  const { after, before } = spec.filter
  if (after && before) parts.push(`${after} to ${before}`)
  else if (after) parts.push(`from ${after}`)
  else if (before) parts.push(`until ${before}`)
  if (spec.keywords.length)
    parts.push(
      keywordAxis(spec)
        ? `for ${spec.keywords.map((k) => `“${k}”`).join(", ")}`
        : `entries mentioning ${spec.keywords.map((k) => `“${k}”`).join(" or ")}`,
    )
  else if (keywordAxis(spec)) parts.push("for your key words")
  return parts.join(", ")
}

function pick<T extends readonly string[]>(
  options: T,
  value: unknown,
  fallback: T[number],
): T[number] {
  return options.includes(value as string) ? (value as T[number]) : fallback
}

// Validate anything (request body, saved JSON, LLM output) into a safe spec.
export function parseSpec(raw: unknown): ChartSpec {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Chart spec must be an object")
  }
  const r = raw as Record<string, unknown>
  const f = (
    typeof r.filter === "object" && r.filter !== null ? r.filter : {}
  ) as Record<string, unknown>

  const filter: ChartSpec["filter"] = {}
  const purpose = PURPOSE_NAMES.find(
    (p) => p.toLowerCase() === String(f.purpose ?? "").toLowerCase(),
  )
  if (purpose) filter.purpose = purpose
  const topic = TOPIC_NAMES.find(
    (t) => t.toLowerCase() === String(f.topic ?? "").toLowerCase(),
  )
  if (topic) filter.topic = topic
  const category = HIGHLIGHT_CATEGORIES.find(
    (c) => c.toLowerCase() === String(f.category ?? "").toLowerCase(),
  )
  if (category) filter.category = category
  const day = (v: unknown) =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(new Date(`${v}T00:00`).getTime())
      ? v
      : undefined
  const after = day(f.after)
  const before = day(f.before)
  if (after) filter.after = after
  if (before) filter.before = before
  // the wrong way round: swap them
  if (after && before && after > before) {
    filter.after = before
    filter.before = after
  }

  const spec = {
    measure: pick(MEASURES, r.measure, "entries"),
    groupBy: pick(GROUPS, r.groupBy, "month"),
    splitBy: pick(SPLITS, r.splitBy, "none"),
    chart: pick(CHARTS, r.chart, "bar"),
    normalize: r.normalize === true,
    filter,
    keywords: cleanKeywords(r.keywords),
  }
  // splitting by the same thing you group by says nothing
  if (spec.splitBy === spec.groupBy) spec.splitBy = "none"
  if (spec.splitBy === "none") spec.normalize = false

  const title =
    typeof r.title === "string" && r.title.trim()
      ? r.title.trim().slice(0, 120)
      : defaultTitle(spec)
  return { title, ...spec }
}
