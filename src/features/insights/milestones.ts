import { dayKey, monthKey } from "@/features/notes/lib/time"

// Quiet milestones for Stats: plain lines about what you reached lately
// (the 100th entry, the first entry of a new month, your longest streak
// yet), worked out from the entries' dates and lengths. No AI.

export type Milestone = {
  id: string
  text: string
  // when it was reached (YYYY-MM-DD)
  day: string
}

type Entry = { date: Date; words: number }

// shown for this long after they're reached
export const RECENT_DAYS = 30

const ENTRY_MARKS = [10, 25, 50, 100, 250, 500, 750, 1000, 1500, 2000, 3000]
const WORD_MARKS = [
  10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000,
]
// a gap this long before an entry makes it "back after a while"
const LONG_GAP_DAYS = 21

const DAY_MS = 24 * 60 * 60 * 1000
// calendar days from a to b (by local date)
const daysFrom = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS,
  )

const ordinal = (n: number) => {
  const tens = n % 100
  const suffix =
    tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")
  return `${n.toLocaleString("en-US")}${suffix}`
}

const monthName = (key: string) =>
  new Date(`${key}-15T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
  })

// the Monday a day's week starts on (YYYY-MM-DD)
function weekOf(day: string) {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return dayKey(d)
}

export function milestones(entries: Entry[], today = new Date()): Milestone[] {
  const todayKey = dayKey(today)
  const recent = (day: string) => {
    const ago = daysFrom(day, todayKey)
    return ago >= 0 && ago < RECENT_DAYS
  }
  // (an entry dated in the future isn't reached yet)
  const sorted = entries
    .map((e) => ({ day: dayKey(e.date), words: e.words }))
    .filter((e) => e.day <= todayKey)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
  const found: Milestone[] = []

  // the 10th, 100th… entry, and 10,000, 100,000… words
  let words = 0
  sorted.forEach((e, i) => {
    const n = i + 1
    if (ENTRY_MARKS.includes(n) && recent(e.day))
      found.push({
        id: `entries-${n}`,
        day: e.day,
        text: `Your ${ordinal(n)} entry`,
      })
    const before = words
    words += e.words
    for (const mark of WORD_MARKS)
      if (before < mark && words >= mark && recent(e.day))
        found.push({
          id: `words-${mark}`,
          day: e.day,
          text: `${mark.toLocaleString("en-US")} words written in all`,
        })
  })

  const days = [...new Set(sorted.map((e) => e.day))]

  // the first entry of a month (or after a long gap), lately
  days.forEach((day, i) => {
    if (!recent(day)) return
    const prev = days[i - 1]
    if (prev && daysFrom(prev, day) >= LONG_GAP_DAYS) {
      const weeks = Math.round(daysFrom(prev, day) / 7)
      found.push({
        id: `back-${day}`,
        day,
        text: `Back to writing after ${weeks} weeks`,
      })
    } else if (
      prev &&
      monthKey(new Date(`${prev}T12:00:00`)) !== day.slice(0, 7)
    )
      found.push({
        id: `month-${day.slice(0, 7)}`,
        day,
        text: `First entry of ${monthName(day.slice(0, 7))}`,
      })
  })

  // runs of days in a row: the latest one, if it's the longest yet
  const runs: { start: string; end: string; length: number }[] = []
  for (const day of days) {
    const last = runs.at(-1)
    if (last && daysFrom(last.end, day) === 1) {
      last.end = day
      last.length += 1
    } else runs.push({ start: day, end: day, length: 1 })
  }
  const latest = runs.at(-1)
  if (latest && latest.length >= 3 && recent(latest.end)) {
    const before = Math.max(0, ...runs.slice(0, -1).map((r) => r.length))
    if (latest.length > before)
      found.push({
        id: `streak-${latest.start}`,
        day: latest.end,
        text: `${latest.length} days in a row: your longest streak yet`,
      })
  }

  // the most days written in a month, and entries in a week, so far
  const record = (
    group: (day: string) => string,
    count: (inGroup: string[]) => number,
    least: number,
    say: (n: number, key: string) => string,
    id: string,
  ) => {
    const groups = new Map<string, string[]>()
    for (const e of sorted) {
      const key = group(e.day)
      groups.set(key, [...(groups.get(key) ?? []), e.day])
    }
    // each group that beat every one before it; the newest one shown
    let best = 0
    let newest: Milestone | null = null
    ;[...groups].forEach(([key, list], i) => {
      const n = count(list)
      const lastDay = list.at(-1)!
      if (i > 0 && n >= least && n > best && recent(lastDay))
        newest = { id: `${id}-${key}`, day: lastDay, text: say(n, key) }
      best = Math.max(best, n)
    })
    if (newest) found.push(newest)
  }
  record(
    (day) => day.slice(0, 7),
    (list) => new Set(list).size,
    5,
    (n, key) =>
      `Wrote on ${n} days in ${monthName(key)}, more than any month before`,
    "month-days",
  )
  record(
    weekOf,
    (list) => list.length,
    3,
    (n, week) =>
      `${n} entries ${
        week === weekOf(todayKey)
          ? "this week"
          : `in the week of ${new Date(`${week}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      }, your most in a week`,
    "week-entries",
  )

  // newest first
  return found.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
}
