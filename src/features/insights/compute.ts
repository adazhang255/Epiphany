import {
  CATEGORY_COLORS,
  HIGHLIGHT_CATEGORIES,
  PURPOSE_COLORS,
  PURPOSE_NAMES,
  TOPIC_NAMES,
  topicColor,
  UNLABELED_COLOR,
} from "@/features/notes/lib/topics"
import type { ChartSpec } from "@/features/insights/spec"

// Serializable per-note data the charts are computed from.
export type InsightNote = {
  id: string
  title: string
  date: string // ISO
  words: number
  purposes: string[]
  sentiment: number | null // -2..2
  topics: string[]
  quotes: { category: string }[]
}

export type ChartSeries = { name: string; color: string; values: number[] }

export type ChartData = {
  labels: string[]
  series: ChartSeries[]
  // one factual sentence describing the data
  summary: string
  // plain-language caveats shown under the chart
  notes: string[]
}

const SINGLE_COLOR = "#e8c27a"
const UNLABELED = "Not analyzed"
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
// Fill empty periods only while the axis stays readable.
const MAX_FILLED = 92

type Item = {
  date: Date
  weight: number
  purposes: string[]
  topics: string[]
  categories: string[]
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function startOfWeek(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)) // Monday
  return s
}

function timeKey(d: Date, unit: "day" | "week" | "month" | "year") {
  if (unit === "year") return `${d.getFullYear()}`
  if (unit === "month") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  const day = unit === "week" ? startOfWeek(d) : d
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

function nextTime(key: string, unit: "day" | "week" | "month" | "year") {
  if (unit === "year") return `${Number(key) + 1}`
  const [y, m, d] = key.split("-").map(Number)
  if (unit === "month") return timeKey(new Date(y, m, 1), "month")
  return timeKey(new Date(y, m - 1, d + (unit === "week" ? 7 : 1)), "day")
}

function timeLabel(key: string, unit: "day" | "week" | "month" | "year") {
  if (unit === "year") return key
  const [y, m, d] = key.split("-").map(Number)
  const date = new Date(y, m - 1, d || 1)
  if (unit === "month") {
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
  }
  const text = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  })
  return unit === "week" ? `Wk of ${text}` : text
}

function toItems(spec: ChartSpec, notes: InsightNote[]): Item[] {
  const { topic, category, purpose } = spec.filter
  const items: Item[] = []
  for (const note of notes) {
    if (topic && !note.topics.includes(topic)) continue
    if (purpose && !note.purposes.includes(purpose)) continue
    const date = new Date(note.date)

    if (spec.measure === "highlights") {
      for (const q of note.quotes) {
        if (category && q.category !== category) continue
        items.push({
          date,
          weight: 1,
          purposes: note.purposes,
          topics: note.topics,
          categories: [q.category],
        })
      }
      continue
    }

    const categories = Array.from(new Set(note.quotes.map((q) => q.category)))
    if (category && !categories.includes(category)) continue
    items.push({
      date,
      weight: spec.measure === "words" ? note.words : 1,
      purposes: note.purposes,
      topics: note.topics,
      categories,
    })
  }
  return items
}

function keysFor(item: Item, by: ChartSpec["groupBy"]): string[] {
  switch (by) {
    case "day":
    case "week":
    case "month":
    case "year":
      return [timeKey(item.date, by)]
    case "weekday":
      return [WEEKDAYS[(item.date.getDay() + 6) % 7]]
    case "purpose":
      return item.purposes
    case "topic":
      return item.topics
    case "category":
      return item.categories
  }
}

function orderKeys(
  spec: ChartSpec,
  totals: Map<string, number>,
  notes: string[],
) {
  const present = [...totals.keys()]
  switch (spec.groupBy) {
    case "weekday":
      return WEEKDAYS
    case "purpose":
      return PURPOSE_NAMES.filter((p) => totals.has(p)) as string[]
    case "topic":
      return TOPIC_NAMES.filter((t) => totals.has(t))
    case "category":
      return HIGHLIGHT_CATEGORIES.filter((c) => totals.has(c)) as string[]
    default: {
      const unit = spec.groupBy
      const sorted = present.sort()
      if (sorted.length < 2) return sorted
      const filled: string[] = []
      for (
        let k = sorted[0];
        k <= sorted.at(-1)! && filled.length <= MAX_FILLED;
        k = nextTime(k, unit)
      ) {
        filled.push(k)
      }
      if (filled.length > MAX_FILLED) {
        notes.push(
          "Only periods with entries are shown; the gaps between them are skipped.",
        )
        return sorted
      }
      return filled
    }
  }
}

export function computeChart(spec: ChartSpec, data: InsightNote[]): ChartData {
  const notes: string[] = []
  const items = toItems(spec, data)
  const split = spec.splitBy

  // cells[x][series] = value
  const cells = new Map<string, Map<string, number>>()
  const totals = new Map<string, number>()
  let unlabeled = 0

  for (const item of items) {
    const xs = keysFor(item, spec.groupBy)
    if (xs.length === 0) {
      unlabeled++
      continue
    }
    const ss = split === "none" ? ["value"] : keysFor(item, split)
    const seriesKeys = ss.length ? ss : [UNLABELED]
    for (const x of xs) {
      const row = cells.get(x) ?? new Map<string, number>()
      cells.set(x, row)
      for (const s of seriesKeys) {
        row.set(s, (row.get(s) ?? 0) + item.weight)
      }
      totals.set(x, (totals.get(x) ?? 0) + item.weight)
    }
  }

  if (unlabeled > 0) {
    notes.push(
      `${unlabeled} ${spec.measure === "highlights" ? "highlights" : "entries"} left out because they have no ${spec.groupBy === "category" ? "highlight type" : spec.groupBy} yet.`,
    )
  }
  if (["topic", "tag", "category"].includes(spec.groupBy) || split !== "none") {
    notes.push("An item with several labels counts once under each.")
  }

  const labels = orderKeys(spec, totals, notes)

  let seriesNames: string[]
  if (split === "none") seriesNames = ["value"]
  else {
    const seen = new Set<string>()
    for (const row of cells.values()) for (const k of row.keys()) seen.add(k)
    const order: string[] =
      split === "topic"
        ? [...TOPIC_NAMES]
        : split === "purpose"
          ? [...PURPOSE_NAMES]
          : [...HIGHLIGHT_CATEGORIES]
    seriesNames = [
      ...order.filter((o) => seen.has(o)),
      ...(seen.has(UNLABELED) ? [UNLABELED] : []),
    ]
  }

  const series: ChartSeries[] = seriesNames.map((name) => ({
    name:
      split === "none"
        ? spec.measure === "words"
          ? "Words"
          : spec.measure === "highlights"
            ? "Highlights"
            : "Entries"
        : name,
    color:
      split === "none"
        ? SINGLE_COLOR
        : name === UNLABELED
          ? UNLABELED_COLOR
          : split === "topic"
            ? topicColor(name)
            : split === "purpose"
              ? (PURPOSE_COLORS[name] ?? UNLABELED_COLOR)
              : (CATEGORY_COLORS[name] ?? UNLABELED_COLOR),
    values: labels.map((x) => cells.get(x)?.get(name) ?? 0),
  }))

  if (spec.normalize) {
    labels.forEach((_, i) => {
      const sum = series.reduce((acc, s) => acc + s.values[i], 0)
      if (sum > 0) series.forEach((s) => (s.values[i] = s.values[i] / sum))
    })
  }

  const unit = ["day", "week", "month", "year"].includes(spec.groupBy)
    ? (spec.groupBy as "day" | "week" | "month" | "year")
    : null
  const shown = unit ? labels.map((k) => timeLabel(k, unit)) : labels
  return {
    labels: shown,
    series,
    summary: summarize(shown, series, spec, unit !== null),
    notes,
  }
}

function fmt(v: number, percent: boolean) {
  return percent ? `${Math.round(v * 100)}%` : `${Math.round(v * 10) / 10}`
}

// Written from the numbers, not by a model, so it can't misstate them.
function summarize(
  labels: string[],
  series: ChartSeries[],
  spec: ChartSpec,
  isTime: boolean,
) {
  if (labels.length === 0) return ""
  const unit = spec.measure === "words" ? "words" : spec.measure

  if (series.length === 1) {
    const values = series[0].values
    const top = values.indexOf(Math.max(...values))
    let text = `Most ${unit}: ${labels[top]} (${fmt(values[top], false)}).`
    if (isTime && labels.length > 1) {
      text += ` ${labels[0]}: ${fmt(values[0], false)} → ${labels.at(-1)}: ${fmt(values.at(-1)!, false)}.`
    }
    return text
  }

  if (spec.normalize && isTime && labels.length > 1) {
    const first = [...series].sort((a, b) => b.values[0] - a.values[0])[0]
    const last = [...series].sort(
      (a, b) => b.values.at(-1)! - a.values.at(-1)!,
    )[0]
    return `${first.name} led in ${labels[0]} (${fmt(first.values[0], true)}); ${last.name} led in ${labels.at(-1)} (${fmt(last.values.at(-1)!, true)}).`
  }

  const totals = series
    .map((s) => ({ name: s.name, total: s.values.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
  return spec.normalize
    ? `${totals[0].name} takes the largest share overall.`
    : `Most ${unit} overall: ${totals
        .slice(0, 2)
        .map((t) => `${t.name} (${fmt(t.total, false)})`)
        .join(", then ")}.`
}
