// Find natural entry breaks in a long document without any AI: headings and
// short lines that start with a date ("1/5 - Sunday 10:35 pm", "June 27,
// 2026", "2026-06-27"). Every word of the document stays in an entry: the
// date line itself is kept as the entry's first line.

export type Segment = {
  heading: string | null // the heading or date line that opened this entry
  date: string | null // YYYY-MM-DD if the marker contained a date
  content: string
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]
const MONTH_RE =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
// a weekday name, full or short ("Wednesday", "Wed", "Thurs.")
const WEEKDAY_RE =
  "(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)\\.?"
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

function iso(y: number, m: number, d: number) {
  const date = new Date(y, m - 1, d)
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function monthIndex(name: string) {
  return (
    MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3))) + 1
  )
}

// A date at the start of a short line, as written: month and day, the year
// if given, and the weekday if one is written right before or after the date
// ("Wed, Jan 1", "1/1 - Wednesday 10:35 pm", "1/11 - Saturday (ish)"). The
// rest of the line can be anything short. null if the line isn't one.
export type DateLine = {
  m: number
  d: number
  year: number | null
  weekday: string | null // "sun" … "sat"
}

// what may follow the date: nothing, or a space or punctuation (not "1/12x")
const AFTER_DATE = /^(?:$|[\s,.:;()|*_–—-])/
const shortWeekday = (name: string) => name.slice(0, 3).toLowerCase()

export function readDateLine(line: string): DateLine | null {
  let text = line
    .replace(/^#+\s*/, "")
    .replace(/^[*_]+/, "")
    .trim()
  if (!text || text.length > 60) return null
  let weekday: string | null = null
  const lead = text.match(new RegExp(`^${WEEKDAY_RE}\\s*[,–—:-]?\\s+`, "i"))
  if (lead) {
    weekday = shortWeekday(lead[1])
    text = text.slice(lead[0].length)
  }

  const twoDigitYear = (y: string) => (y.length === 2 ? 2000 + +y : +y)
  let found: {
    m: number
    d: number
    year: number | null
    length: number
  } | null = null
  let r = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (r) found = { year: +r[1], m: +r[2], d: +r[3], length: r[0].length }
  if (!found) {
    r = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2})(?!\d))?/)
    if (r)
      found = {
        m: +r[1],
        d: +r[2],
        year: r[3] ? twoDigitYear(r[3]) : null,
        length: r[0].length,
      }
  }
  if (!found) {
    r = text.match(
      new RegExp(
        `^${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`,
        "i",
      ),
    )
    if (r)
      found = {
        m: monthIndex(r[1]),
        d: +r[2],
        year: r[3] ? +r[3] : null,
        length: r[0].length,
      }
  }
  if (!found) {
    r = text.match(
      new RegExp(
        `^(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?(?:,?\\s+(\\d{4}))?`,
        "i",
      ),
    )
    if (r)
      found = {
        m: monthIndex(r[2]),
        d: +r[1],
        year: r[3] ? +r[3] : null,
        length: r[0].length,
      }
  }
  if (!found || found.m < 1 || found.m > 12 || found.d < 1 || found.d > 31)
    return null
  const after = text.slice(found.length)
  if (!AFTER_DATE.test(after)) return null
  const trailing = after.match(
    new RegExp(`^\\s*[,–—:|-]?\\s*\\(?${WEEKDAY_RE}(?![a-z])`, "i"),
  )
  if (trailing) weekday ??= shortWeekday(trailing[1])
  return { m: found.m, d: found.d, year: found.year, weekday }
}

const TOMORROW = () => Date.now() + 86_400_000

// The year for a month and day written without one: the latest year (from
// `fallbackYear` back) whose date falls on the weekday written beside it
// ("1/1 - Wednesday" → 2025), else `fallbackYear`; never a date to come
// (a December entry written down in October is last year's).
function yearFor(
  m: number,
  d: number,
  weekday: string | null,
  fallbackYear: number,
) {
  const fits = (y: number) => {
    const date = new Date(y, m - 1, d)
    return (
      date.getMonth() === m - 1 &&
      date.getTime() <= TOMORROW() &&
      (!weekday || WEEKDAYS[date.getDay()] === weekday)
    )
  }
  for (let y = fallbackYear; y > fallbackYear - 30; y--) if (fits(y)) return y
  return fallbackYear
}

// One date line on its own, as YYYY-MM-DD (or null if it isn't one).
export function parseDateLine(
  line: string,
  fallbackYear: number,
): string | null {
  const r = readDateLine(line)
  if (!r) return null
  return iso(r.year ?? yearFor(r.m, r.d, r.weekday, fallbackYear), r.m, r.d)
}

// Years for a document's date lines, in order, worked out together: a
// journal runs forward, so the year carries from one date to the next (one
// written out sets it; going from late in the year back to early moves it
// on). The starting year is the one whose dates fall on the most of the
// weekdays written (so one slip, "3/8 - Friday", doesn't move a day to
// another year), the latest if none say, and never one that puts a date in
// the future.
export function datesFor(
  lines: DateLine[],
  fallbackYear = new Date().getFullYear(),
): (string | null)[] {
  const run = (start: number) => {
    let year = start
    let prev: number | null = null
    return lines.map((l) => {
      if (l.year) year = l.year
      else if (prev !== null && prev - l.m >= 6) year++
      prev = l.m
      return { y: l.year ?? year, l }
    })
  }
  let best = { start: fallbackYear, score: -Infinity }
  for (let start = fallbackYear; start > fallbackYear - 30; start--) {
    let score = 0
    for (const { y, l } of run(start)) {
      const date = new Date(y, l.m - 1, l.d)
      if (date.getTime() > TOMORROW()) score -= 1000
      else if (l.weekday && WEEKDAYS[date.getDay()] === l.weekday) score++
    }
    if (score > best.score) best = { start, score }
  }
  return run(best.start).map(({ y, l }) => iso(y, l.m, l.d))
}

export function splitOnMarkers(
  text: string,
  fallbackYear = new Date().getFullYear(),
): Segment[] {
  const lines = text.split("\n")
  type Marker = { index: number; title: string | null; date: DateLine | null }
  const markers: Marker[] = []
  lines.forEach((line, index) => {
    const date = readDateLine(line)
    const isHeading = /^#+\s+\S/.test(line)
    if (date || isHeading)
      markers.push({
        index,
        title: date ? null : line.replace(/^#+\s*/, "").trim(),
        date,
      })
  })

  // A date line directly followed by a heading (or the other way round) is
  // one break.
  const merged: Marker[] = []
  for (const marker of markers) {
    const last = merged.at(-1)
    const between = last
      ? lines
          .slice(last.index + 1, marker.index)
          .join("")
          .trim()
      : "x"
    if (last && between === "" && !(last.date && marker.date)) {
      last.date ??= marker.date
      last.title ??= marker.title
      continue
    }
    merged.push({ ...marker })
  }

  const dated = merged.filter((m) => m.date)
  const isoDates = datesFor(
    dated.map((m) => m.date!),
    fallbackYear,
  )
  const dateOf = new Map(dated.map((m, i) => [m, isoDates[i]]))

  if (merged.length < 2) {
    return [
      {
        heading: merged[0]?.title ?? null,
        date: (merged[0] && dateOf.get(merged[0])) ?? null,
        content: text.trim(),
      },
    ]
  }

  // the entry's own lines, from its date line or heading ("# " markup off)
  const linesOf = (from: number, to: number) =>
    lines
      .slice(from, to)
      .map((l, i) =>
        markers.some((m) => m.index === from + i) ? l.replace(/^#+\s*/, "") : l,
      )
      .join("\n")
      .trim()

  const segments: Segment[] = []
  // text before the first date: its own entry, or (a line or two) part of
  // the first one
  const preamble = linesOf(0, merged[0].index)
  const ownPreamble = preamble.length > 40
  if (ownPreamble)
    segments.push({ heading: null, date: null, content: preamble })
  merged.forEach((marker, i) => {
    const from = i === 0 && !ownPreamble ? 0 : marker.index
    const to = merged[i + 1]?.index ?? lines.length
    segments.push({
      heading: marker.title,
      date: dateOf.get(marker) ?? null,
      content: linesOf(from, to),
    })
  })
  return segments
}
