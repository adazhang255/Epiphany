import {
  HIGHLIGHT_CATEGORIES,
  PURPOSE_NAMES,
  TOPIC_NAMES,
} from "@/features/notes/lib/topics"

// A chart is described by this small spec. The builder edits it by hand, the
// AI fills it in from a question, and compute() turns it into numbers, so
// the model never makes up data.
export const MEASURES = ["entries", "highlights", "words"] as const
export const GROUPS = [
  "day",
  "week",
  "month",
  "year",
  "weekday",
  "purpose",
  "topic",
  "category",
] as const
export const SPLITS = ["none", "purpose", "topic", "category"] as const
export const CHARTS = ["bar", "line", "area"] as const

export type ChartSpec = {
  title: string
  measure: (typeof MEASURES)[number]
  groupBy: (typeof GROUPS)[number]
  splitBy: (typeof SPLITS)[number]
  chart: (typeof CHARTS)[number]
  // show each split as a share of its column instead of a count
  normalize: boolean
  filter: { purpose?: string; topic?: string; category?: string }
}

export const MEASURE_LABEL: Record<ChartSpec["measure"], string> = {
  entries: "Entries",
  highlights: "Highlights",
  words: "Words written",
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
}

export const SPLIT_LABEL: Record<ChartSpec["splitBy"], string> = {
  none: "Nothing",
  purpose: "Category",
  topic: "Topic",
  category: "Highlight type",
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

  const spec = {
    measure: pick(MEASURES, r.measure, "entries"),
    groupBy: pick(GROUPS, r.groupBy, "month"),
    splitBy: pick(SPLITS, r.splitBy, "none"),
    chart: pick(CHARTS, r.chart, "bar"),
    normalize: r.normalize === true,
    filter,
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
