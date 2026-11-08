import { describe, expect, it } from "vitest"
import { milestones } from "@/features/insights/milestones"

// an entry on a local date ("2026-11-04"), of so many words
const on = (day: string, words = 100) => ({
  date: new Date(`${day}T09:00:00`),
  words,
})
const today = new Date("2026-11-06T12:00:00")
const texts = (list: ReturnType<typeof milestones>) => list.map((m) => m.text)

describe("milestones", () => {
  it("marks the 10th entry, if it was lately", () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      on(`2026-10-${String(i * 2 + 1).padStart(2, "0")}`),
    )
    expect(texts(milestones(days, today))).toContain("Your 10th entry")
    // long ago: not shown
    expect(
      texts(milestones(days, new Date("2027-03-01T12:00:00"))),
    ).not.toContain("Your 10th entry")
  })

  it("marks passing a number of words", () => {
    const list = milestones(
      [on("2026-09-01", 9_000), on("2026-11-02", 2_000)],
      today,
    )
    expect(texts(list)).toContain("10,000 words written in all")
  })

  it("marks the first entry of a month, or coming back after a while", () => {
    expect(
      texts(milestones([on("2026-10-28"), on("2026-11-02")], today)),
    ).toContain("First entry of November")
    expect(
      texts(milestones([on("2026-09-20"), on("2026-11-02")], today)),
    ).toContain("Back to writing after 6 weeks")
  })

  it("marks the longest streak yet, not a shorter one", () => {
    const old = ["2026-08-01", "2026-08-02", "2026-08-03"].map((d) => on(d))
    const now = ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"].map(
      (d) => on(d),
    )
    expect(texts(milestones([...old, ...now], today))).toContain(
      "4 days in a row: your longest streak yet",
    )
    expect(
      texts(milestones([...old, ...now.slice(0, 3)], today)).some((t) =>
        t.includes("streak"),
      ),
    ).toBe(false)
  })

  it("marks a record month and week", () => {
    const sept = ["2026-09-01", "2026-09-08", "2026-09-15"].map((d) => on(d))
    const oct = [
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-20",
    ].map((d) => on(d))
    const list = texts(
      milestones([...sept, ...oct], new Date("2026-10-21T12:00:00")),
    )
    expect(list).toContain(
      "Wrote on 5 days in October, more than any month before",
    )
    expect(list).toContain(
      "4 entries in the week of Oct 5, your most in a week",
    )
  })

  it("ignores entries dated in the future, and is quiet with nothing new", () => {
    expect(milestones([on("2026-12-25")], today)).toEqual([])
    expect(milestones([on("2025-01-01"), on("2025-01-09")], today)).toEqual([])
  })
})
