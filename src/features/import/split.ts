// Find natural entry breaks in a long document without any AI: headings and
// lines that are just a date ("June 27, 2026", "2026-06-27", "6/27").

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
const WEEKDAY_RE =
  "(?:(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?\\.?,?\\s+)?"

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

// A date written in a short line, or null. Years default to `fallbackYear`.
export function parseDateLine(
  line: string,
  fallbackYear: number,
): string | null {
  const text = line
    .replace(/^#+\s*/, "")
    .trim()
    .replace(/[.:]$/, "")
  if (text.length > 40) return null
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (m) {
    const year = m[3]
      ? m[3].length === 2
        ? 2000 + +m[3]
        : +m[3]
      : fallbackYear
    return iso(year, +m[1], +m[2])
  }
  m = text.match(
    new RegExp(
      `^${WEEKDAY_RE}${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?$`,
      "i",
    ),
  )
  if (m) return iso(m[3] ? +m[3] : fallbackYear, monthIndex(m[1]), +m[2])
  m = text.match(
    new RegExp(
      `^${WEEKDAY_RE}(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?(?:,?\\s+(\\d{4}))?$`,
      "i",
    ),
  )
  if (m) return iso(m[3] ? +m[3] : fallbackYear, monthIndex(m[2]), +m[1])
  return null
}

export function splitOnMarkers(
  text: string,
  fallbackYear = new Date().getFullYear(),
): Segment[] {
  const lines = text.split("\n")
  const markers: { index: number; heading: string; date: string | null }[] = []
  lines.forEach((line, index) => {
    const date = parseDateLine(line, fallbackYear)
    const isHeading = /^#+\s+\S/.test(line)
    if (date || isHeading) {
      markers.push({ index, heading: line.replace(/^#+\s*/, "").trim(), date })
    }
  })

  // A date heading directly followed by a title heading (or vice versa) is one break.
  const merged: typeof markers = []
  for (const marker of markers) {
    const last = merged.at(-1)
    const between = last
      ? lines
          .slice(last.index + 1, marker.index)
          .join("")
          .trim()
      : "x"
    if (last && between === "") {
      last.date ??= marker.date
      if (!marker.date) last.heading = marker.heading
      continue
    }
    merged.push({ ...marker })
  }

  if (merged.length < 2) {
    return [
      {
        heading: merged[0]?.heading ?? null,
        date: merged[0]?.date ?? null,
        content: text.trim(),
      },
    ]
  }

  const segments: Segment[] = []
  const preamble = lines.slice(0, merged[0].index).join("\n").trim()
  if (preamble.length > 40)
    segments.push({ heading: null, date: null, content: preamble })
  merged.forEach((marker, i) => {
    const end = merged[i + 1]?.index ?? lines.length
    const content = lines
      .slice(marker.index + 1, end)
      .join("\n")
      .trim()
    if (content) {
      segments.push({
        heading:
          marker.date && parseDateLine(marker.heading, fallbackYear)
            ? null
            : marker.heading,
        date: marker.date,
        content,
      })
    }
  })
  return segments
}
