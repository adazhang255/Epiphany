import type { InsightNote } from "@/features/insights/compute"
import type { HeatmapDay } from "@/components/DayHeatmap"
import { dayKey } from "@/features/notes/lib/time"

// Per day: entry count, how many highlights of each type (Questions
// aside), and average tone. A day's color is its most frequent highlight
// type, so entries with no highlights don't color it. Also the total of each
// highlight type across every entry.
export function writingDays(notes: InsightNote[]) {
  const counts: Record<
    string,
    {
      entries: number
      words: number
      categories: Record<string, number>
      latest: string | null
      tones: number[]
    }
  > = {}
  const categoryTotals = new Map<string, number>()
  for (const note of notes) {
    const day = (counts[dayKey(new Date(note.date))] ??= {
      entries: 0,
      words: 0,
      categories: {},
      latest: null,
      tones: [],
    })
    day.entries += 1
    day.words += note.words
    for (const { category } of note.quotes) {
      if (category === "Question") continue
      day.categories[category] = (day.categories[category] ?? 0) + 1
      day.latest = category
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + 1)
    }
    if (note.sentiment !== null) day.tones.push(note.sentiment)
  }
  const days: Record<string, HeatmapDay> = {}
  for (const [key, day] of Object.entries(counts)) {
    // one color per day: the most common highlight type (ties: the latest)
    const top = Math.max(0, ...Object.values(day.categories))
    const tied = Object.keys(day.categories).filter(
      (c) => day.categories[c] === top,
    )
    days[key] = {
      entries: day.entries,
      words: day.words,
      category: tied.length === 1 ? tied[0] : day.latest,
      categories: day.categories,
      sentiment: day.tones.length
        ? day.tones.reduce((a, b) => a + b, 0) / day.tones.length
        : null,
    }
  }
  return { days, categoryTotals }
}
