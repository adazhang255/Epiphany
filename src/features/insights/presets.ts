import type { InsightNote } from "@/features/insights/compute"
import { keyWords, topWords } from "@/features/insights/keywords"
import type { ChartSpec } from "@/features/insights/spec"

// Chart suggestions on Custom: a fixed set, plus some made from the entries
// (your most used words, this year, the last month). Shown a few at a time,
// in an order that changes every visit; "More ideas" goes through them all
// before any comes back.

export type Preset = { label: string; spec: Partial<ChartSpec> }

const BASE: Preset[] = [
  {
    label: "Words written per month",
    spec: { measure: "words", groupBy: "month", chart: "line" },
  },
  {
    label: "Which weekdays I write",
    spec: { measure: "entries", groupBy: "weekday" },
  },
  {
    label: "Kinds of highlights",
    spec: { measure: "highlights", groupBy: "category" },
  },
  {
    label: "Why I write, over time",
    spec: {
      measure: "entries",
      groupBy: "month",
      splitBy: "purpose",
      chart: "area",
      normalize: true,
    },
  },
  {
    label: "Highlight types per topic",
    spec: { measure: "highlights", groupBy: "topic", splitBy: "category" },
  },
  {
    label: "Entries per week",
    spec: { measure: "entries", groupBy: "week", chart: "line" },
  },
  {
    label: "Words by weekday",
    spec: { measure: "words", groupBy: "weekday" },
  },
  {
    label: "Highlights each month",
    spec: { measure: "highlights", groupBy: "month", splitBy: "category" },
  },
  {
    label: "Which categories I write most",
    spec: { measure: "entries", groupBy: "purpose" },
  },
  {
    label: "Words per category",
    spec: { measure: "words", groupBy: "purpose" },
  },
  {
    label: "Kinds of highlights, over time",
    spec: {
      measure: "highlights",
      groupBy: "month",
      splitBy: "category",
      chart: "area",
      normalize: true,
    },
  },
  {
    label: "Year by year",
    spec: { measure: "entries", groupBy: "year", splitBy: "purpose" },
  },
  {
    label: "Weekdays by category",
    spec: { measure: "entries", groupBy: "weekday", splitBy: "purpose" },
  },
  {
    label: "Highlight kinds per category",
    spec: { measure: "highlights", groupBy: "purpose", splitBy: "category" },
  },
]

const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export function presetsFor(notes: InsightNote[], now = new Date()): Preset[] {
  const made: Preset[] = []
  const texts = notes.map((n) => n.text)
  let top = keyWords(texts, 5)
  if (top.length < 2) top = topWords(texts, 5)
  if (top.length >= 2)
    made.push(
      {
        label: "Your key words, over time",
        spec: {
          measure: "mentions",
          groupBy: "month",
          splitBy: "keyword",
          chart: "line",
        },
      },
      {
        label: "Your key words, compared",
        spec: { measure: "mentions", groupBy: "keyword", keywords: top },
      },
    )
  for (const word of top.slice(0, 2))
    made.push({
      label: `How often you write “${word}”`,
      spec: {
        measure: "mentions",
        groupBy: "month",
        keywords: [word],
        chart: "line",
      },
    })
  const thisYear = `${now.getFullYear()}-01-01`
  if (notes.some((n) => day(new Date(n.date)) >= thisYear))
    made.push(
      {
        label: "This year, week by week",
        spec: {
          measure: "entries",
          groupBy: "week",
          filter: { after: thisYear },
        },
      },
      {
        label: "Words written this year",
        spec: {
          measure: "words",
          groupBy: "month",
          filter: { after: thisYear },
        },
      },
    )
  const monthAgo = new Date(now)
  monthAgo.setDate(monthAgo.getDate() - 30)
  if (notes.some((n) => day(new Date(n.date)) >= day(monthAgo)))
    made.push({
      label: "The last 30 days",
      spec: {
        measure: "entries",
        groupBy: "day",
        filter: { after: day(monthAgo) },
      },
    })
  return [...made, ...BASE]
}

// the same order for the same seed (so the server and the browser agree)
export function shuffled<T>(items: T[], seed: number): T[] {
  let a = Math.floor(seed * 2 ** 32) >>> 0
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export const SHOWN = 5

// The deck the suggestions are dealt from: the next few, or a fresh
// shuffle (with the ones just shown at the back) once they've all been seen.
export type Deck = { order: Preset[]; at: number }
export function nextDeal(deck: Deck, all: Preset[], seed: number): Deck {
  const at = deck.at + SHOWN
  if (at + SHOWN <= deck.order.length) return { ...deck, at }
  const recent = deck.order.slice(deck.at, deck.at + SHOWN)
  const rest = shuffled(
    all.filter((p) => !recent.some((r) => r.label === p.label)),
    seed,
  )
  return { order: [...rest, ...recent], at: 0 }
}
