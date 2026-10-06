const DAY_MS = 24 * 60 * 60 * 1000

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function formatMonth(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long" })
}

export function formatDay(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function calendarDaysBetween(a: Date, b: Date) {
  const startA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const startB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round(Math.abs(startA - startB) / DAY_MS)
}

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`
}

// "3 days", "2 weeks", "4 months" — or null when both dates fall on the same day.
export function describeGap(a: Date, b: Date) {
  const days = calendarDaysBetween(a, b)
  if (days === 0) return null
  if (days < 14) return plural(days, "day")
  if (days < 60) return plural(Math.round(days / 7), "week")
  if (days < 730) return plural(Math.round(days / 30.44), "month")
  return plural(Math.round(days / 365.25), "year")
}

export function describeAgo(date: Date, now = new Date()) {
  const gap = describeGap(date, now)
  if (!gap) return "today"
  return date > now ? `in ${gap}` : `${gap} ago`
}

// Local calendar day as "YYYY-MM-DD"; used to key heatmap cells and anchors.
export function dayKey(date: Date) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`
}
