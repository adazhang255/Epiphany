import { describe, expect, it } from "vitest"
import { computeChart, type InsightNote } from "@/features/insights/compute"
import { countMentions, topWords } from "@/features/insights/keywords"
import { defaultTitle, parseSpec } from "@/features/insights/spec"

const note = (
  date: string,
  text: string,
  extra: Partial<InsightNote> = {},
): InsightNote => ({
  id: date,
  title: "",
  date: `${date}T12:00:00`,
  words: text.split(/\s+/).length,
  purposes: [],
  sentiment: null,
  topics: [],
  quotes: [],
  text,
  ...extra,
})

const notes = [
  note("2025-01-03", "Work was long. Worked late, then walked home. Coffee."),
  note("2025-01-20", "Coffee with Sam. Sam laughed at work stories."),
  note(
    "2025-02-02",
    "Slept in. No work today, just walking and coffee, coffee.",
  ),
  note("2025-02-10", "A quiet day of reading."),
]

describe("countMentions", () => {
  it("counts whole words in any case, with plural and -ed / -ing forms", () => {
    expect(countMentions("Work, worked, working, works; WORK.", "work")).toBe(5)
    expect(countMentions("homework and network", "work")).toBe(0)
    expect(countMentions("Sam's dog and Samuel", "sam")).toBe(1)
  })

  it("counts phrases across spaces", () => {
    expect(countMentions("new  city, the new city", "new city")).toBe(2)
  })
})

describe("keyword charts", () => {
  it("counts mentions per keyword over time, exactly", () => {
    const spec = parseSpec({
      measure: "mentions",
      groupBy: "month",
      splitBy: "keyword",
      keywords: ["work", "coffee"],
    })
    const data = computeChart(spec, notes)
    expect(data.labels).toEqual(["Jan 2025", "Feb 2025"])
    const by = Object.fromEntries(data.series.map((s) => [s.name, s.values]))
    // Jan: work ×3 (Work, Worked, work), coffee ×2; Feb: work ×1, coffee ×2
    expect(by).toEqual({ work: [3, 1], coffee: [2, 2] })
  })

  it("compares keywords side by side", () => {
    const spec = parseSpec({
      measure: "mentions",
      groupBy: "keyword",
      keywords: ["sam", "coffee", "tea"],
    })
    const data = computeChart(spec, notes)
    expect(data.labels).toEqual(["sam", "coffee", "tea"])
    expect(data.series[0].values).toEqual([2, 4, 0])
  })

  it("counts entries that mention each keyword when measuring entries", () => {
    const spec = parseSpec({
      measure: "entries",
      groupBy: "keyword",
      keywords: ["coffee", "work"],
    })
    expect(computeChart(spec, notes).series[0].values).toEqual([3, 3])
  })

  it("only includes entries mentioning a keyword when it's just a filter", () => {
    const spec = parseSpec({
      measure: "entries",
      groupBy: "month",
      keywords: ["sam"],
    })
    expect(computeChart(spec, notes).series[0].values).toEqual([1])
  })

  it("picks the most used words when none are named, and says so", () => {
    const spec = parseSpec({
      measure: "mentions",
      groupBy: "month",
      splitBy: "keyword",
    })
    const data = computeChart(spec, notes)
    expect(data.series[0].name).toBe("coffee")
    expect(data.notes.join(" ")).toMatch(/picked automatically \(written often, but not in every entry\): coffee/)
    expect(topWords(["the the the cats cats dogs"], 2)).toEqual([
      "cats",
      "dogs",
    ])
  })

  it("titles a chart from what it shows", () => {
    const spec = parseSpec({
      measure: "mentions",
      groupBy: "month",
      splitBy: "keyword",
      keywords: ["work"],
    })
    expect(defaultTitle(spec)).toBe(
      "Keyword mentions by month, split by keyword, for “work”",
    )
  })

  it("limits to a date range, both days included", () => {
    const spec = parseSpec({
      measure: "entries",
      groupBy: "month",
      filter: { after: "2025-01-20", before: "2025-02-02" },
    })
    const data = computeChart(spec, notes)
    expect(data.labels).toEqual(["Jan 2025", "Feb 2025"])
    expect(data.series[0].values).toEqual([1, 1])
    expect(defaultTitle(spec)).toMatch(/2025-01-20 to 2025-02-02/)
  })

  it("ignores a date that isn't one, and swaps a reversed range", () => {
    expect(
      parseSpec({ filter: { after: "last week" } }).filter.after,
    ).toBeUndefined()
    expect(
      parseSpec({ filter: { after: "2025-03-01", before: "2025-01-01" } })
        .filter,
    ).toEqual({
      after: "2025-01-01",
      before: "2025-03-01",
    })
  })
})

describe("datesFromRequest", async () => {
  const { datesFromRequest } = await import("@/features/insights/askChart")
  const now = new Date(2026, 9, 16)
  it("reads years and year ranges from the words", () => {
    expect(datesFromRequest("only 2025", now)).toEqual({
      after: "2025-01-01",
      before: "2025-12-31",
    })
    expect(datesFromRequest("from 2024 to 2025", now)).toEqual({
      after: "2024-01-01",
      before: "2025-12-31",
    })
    expect(datesFromRequest("since 2024", now)).toEqual({ after: "2024-01-01" })
    expect(datesFromRequest("just last year please", now)).toEqual({
      after: "2025-01-01",
      before: "2025-12-31",
    })
    expect(datesFromRequest("make it a line", now)).toBeNull()
  })
})

describe("keepUnmentioned", async () => {
  const { keepUnmentioned } = await import("@/features/insights/askChart")
  const current = parseSpec({
    measure: "mentions",
    groupBy: "month",
    splitBy: "keyword",
    chart: "line",
    keywords: ["coffee"],
  })
  it("keeps what a change doesn't mention", () => {
    const drifted = parseSpec({
      ...current,
      normalize: true,
      chart: "area",
      filter: { after: "2025-01-01" },
    })
    const kept = keepUnmentioned(drifted, current, "only 2025")
    expect(kept.normalize).toBe(false)
    expect(kept.chart).toBe("line")
    expect(kept.filter.after).toBe("2025-01-01")
  })
  it("lets a change through when it's asked for", () => {
    const next = parseSpec({ ...current, chart: "bar", normalize: true })
    const kept = keepUnmentioned(next, current, "as bars, showing the share")
    expect(kept.chart).toBe("bar")
    expect(kept.normalize).toBe(true)
  })
})

describe("groundKeywords", async () => {
  const { groundKeywords } = await import("@/features/insights/askChart")
  it("drops keywords copied from the examples, and words about the chart", () => {
    expect(
      groundKeywords(
        ["sam", "coffee", "interesting"],
        "Keyword Frequency by keyword over time for most interesting keywords",
      ),
    ).toEqual([])
  })
  it("keeps the ones named, as whole words", () => {
    expect(groundKeywords(["coffee", "art"], "chart coffee by month")).toEqual([
      "coffee",
    ])
    expect(groundKeywords(["café"], "how often café?")).toEqual(["café"])
  })
  it("keeps the current chart's keywords when changing it", () => {
    const current = parseSpec({ measure: "mentions", keywords: ["tea"] })
    expect(
      groundKeywords(["tea", "milk"], "make it a line, add milk", current),
    ).toEqual(["tea", "milk"])
  })
})
