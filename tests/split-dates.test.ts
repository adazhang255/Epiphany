import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  datesFor,
  parseDateLine,
  readDateLine,
  splitOnMarkers,
} from "@/features/import/split"

// "today" is Oct 14, 2026 for these
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 14, 12))
})
afterAll(() => {
  vi.useRealTimers()
})

describe("parseDateLine", () => {
  it("reads a date with the weekday after it, and takes the year from the weekday", () => {
    // Jan 1 was a Wednesday in 2025 (not 2026)
    expect(parseDateLine("1/1 - Wednesday", 2026)).toBe("2025-01-01")
    expect(parseDateLine("1/2 - Thursday", 2026)).toBe("2025-01-02")
    expect(parseDateLine("1/1 – Wed", 2026)).toBe("2025-01-01")
    expect(parseDateLine("1/1 (Wed)", 2026)).toBe("2025-01-01")
    expect(parseDateLine("1/1, Wednesday:", 2026)).toBe("2025-01-01")
  })

  it("still reads the date when the weekday is misspelt", () => {
    expect(parseDateLine("1/7 - Wendsday", 2026)).toBe("2026-01-07")
  })

  it("reads the weekday before the date too", () => {
    expect(parseDateLine("Wednesday, January 1", 2026)).toBe("2025-01-01")
    expect(parseDateLine("Thurs 2 Jan", 2026)).toBe("2025-01-02")
  })

  it("keeps a year that's written, whatever the weekday", () => {
    expect(parseDateLine("1/1/2024 - Monday", 2026)).toBe("2024-01-01")
    expect(parseDateLine("2026-01-01", 2026)).toBe("2026-01-01")
  })

  it("never places a date without a year in the future", () => {
    // in October, December 25 is last year's
    expect(parseDateLine("12/25", 2026)).toBe("2025-12-25")
    expect(parseDateLine("6/27", 2026)).toBe("2026-06-27")
  })

  it("isn't fooled by ordinary lines", () => {
    expect(parseDateLine("Wednesday was hard", 2026)).toBeNull()
    expect(
      parseDateLine("I met her on 1/1 - Wednesday at the park, again", 2026),
    ).toBeNull()
    expect(parseDateLine("Wednesday", 2026)).toBeNull()
  })
})

describe("splitOnMarkers", () => {
  it("splits a month of '1/1 - Wednesday' entries into one entry a day", () => {
    const names = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]
    const days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(2025, 0, i + 1)
      return `${i + 1 > 31 ? "" : `1/${i + 1}`} - ${names[date.getDay()]}\nWhat happened on day ${i + 1}.\nA second line.`
    })
    const segments = splitOnMarkers(days.join("\n\n"), 2026)
    expect(segments).toHaveLength(30)
    expect(segments[0]).toEqual({
      heading: null,
      date: "2025-01-01",
      content: "1/1 - Wednesday\nWhat happened on day 1.\nA second line.",
    })
    expect(segments[29].date).toBe("2025-01-30")
  })

  it("starts an entry at any short line beginning with a date, whatever follows", () => {
    const text = [
      "1/5 - Sunday 10:35 pm",
      "A.",
      "1/11 - Saturday (but really Friday) 1:37 am",
      "B.",
      "1/9 if it were Friday",
      "C.",
      "2/2 - Sunday 8:18am",
      "10:41 pm: a time inside the entry, not a new one",
      "D.",
      "5/8/25",
      "E.",
    ].join("\n")
    const segments = splitOnMarkers(text, 2026)
    expect(segments.map((s) => s.date)).toEqual([
      "2025-01-05",
      "2025-01-11",
      "2025-01-09",
      "2025-02-02",
      "2025-05-08",
    ])
    expect(segments[3].content).toContain("10:41 pm: a time inside")
  })

  it("drops no text: date lines, a short opening line and empty days all stay", () => {
    const text =
      "Jan notes\n\n1/1 - Wednesday\nA.\n\n1/2 - Thursday\n\n1/3 - Friday\nC."
    const segments = splitOnMarkers(text, 2026)
    expect(segments.map((s) => s.content)).toEqual([
      "Jan notes\n\n1/1 - Wednesday\nA.",
      "1/2 - Thursday",
      "1/3 - Friday\nC.",
    ])
  })
})

describe("readDateLine", () => {
  it("reads the weekday only right next to the date", () => {
    expect(readDateLine("1/9 if it were Friday")).toEqual({
      m: 1,
      d: 9,
      year: null,
      weekday: null,
    })
    expect(
      readDateLine("1/11 - Saturday (but really Friday) 1:37 am")?.weekday,
    ).toBe("sat")
  })

  it("ignores times, long lines and dates glued to other text", () => {
    expect(readDateLine("10:41 pm: and here is a thought")).toBeNull()
    expect(readDateLine("1/12x")).toBeNull()
    expect(readDateLine(`1/1 ${"words ".repeat(15)}`)).toBeNull()
  })
})

describe("datesFor", () => {
  const line = (m: number, d: number, weekday: string | null = null) => ({
    m,
    d,
    year: null,
    weekday,
  })

  it("dates a whole document by the year most of its weekdays fit", () => {
    // 3/8/2025 was a Saturday; one slip ("Friday") doesn't move it to 2024
    expect(
      datesFor([line(3, 6, "thu"), line(3, 7, "fri"), line(3, 8, "fri")], 2026),
    ).toEqual(["2025-03-06", "2025-03-07", "2025-03-08"])
  })

  it("carries the year from December into January", () => {
    expect(
      datesFor(
        [line(12, 30, "mon"), line(12, 31, "tue"), line(1, 1, "wed")],
        2026,
      ),
    ).toEqual(["2024-12-30", "2024-12-31", "2025-01-01"])
  })

  it("uses the latest year that puts nothing in the future when no weekday says", () => {
    expect(datesFor([line(6, 1), line(12, 25)], 2026)).toEqual([
      "2025-06-01",
      "2025-12-25",
    ])
  })
})
