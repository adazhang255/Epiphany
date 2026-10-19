import { describe, expect, it } from "vitest"
import { yearReviews } from "@/features/insights/yearReview"
import type { ThreadView } from "@/features/threads/match"

const note = (
  id: string,
  date: string,
  content: string,
  extra: { sentiment?: number | null; quotes?: string[]; title?: string } = {},
) => ({
  id,
  title: extra.title ?? "",
  content,
  date: new Date(`${date}T12:00:00`),
  sentiment: extra.sentiment ?? null,
  quotes: (extra.quotes ?? []).map((category) => ({ category })),
})

const thread = (title: string | null, dates: string[]): ThreadView => ({
  id: title ?? "t",
  label: null,
  kind: "auto",
  title,
  named: false,
  members: dates.map((d, i) => ({
    id: `${title}-${i}`,
    quote: "the garden keeps coming back to me again and again",
    tags: [],
    noteId: `n${i}`,
    noteTitle: "",
    date: new Date(`${d}T12:00:00`),
    embedding: [],
  })),
})

describe("yearReviews", () => {
  const notes = [
    note("1", "2025-03-02", "garden garden seeds", {
      sentiment: 2,
      quotes: ["Insight", "Insight", "Question"],
    }),
    note("2", "2025-03-09", "garden in the rain, seeds sprouting slowly", {
      sentiment: 1,
      quotes: ["Event"],
      title: "Rain",
    }),
    note("3", "2025-07-01", "short", { sentiment: null }),
    note("4", "2024-12-31", "old year words"),
  ]

  it("gives one review per year, newest first", () => {
    expect(yearReviews(notes, []).map((r) => r.year)).toEqual([2025, 2024])
  })

  it("counts entries, words, days and the busiest month", () => {
    const [y] = yearReviews(notes, [])
    expect(y.entries).toBe(3)
    expect(y.words).toBe(3 + 7 + 1)
    expect(y.days).toBe(3)
    expect(y.busiestMonth).toEqual({ label: "March", entries: 2 })
  })

  it("finds the longest entry, top words, top type and tone", () => {
    const [y] = yearReviews(notes, [])
    expect(y.longest).toEqual({ id: "2", title: "Rain", words: 7 })
    // repeated words of 4+ letters that aren't stop words
    expect(y.topWords).toEqual(["garden", "seeds"])
    // questions don't count as a type
    expect(y.topType).toEqual({ name: "Insight", count: 2 })
    // mean of 2 and 1 rounds to 2; entries without a tone are skipped
    expect(y.tone).toBe("Very positive")
  })

  it("has no tone or type when nothing was scored", () => {
    const [, old] = yearReviews(notes, [])
    expect(old.tone).toBeNull()
    expect(old.topType).toBeNull()
    expect(old.longest?.title).toBe("Untitled thought")
  })

  it("picks the thread with the most passages that year (at least two)", () => {
    const threads = [
      thread("Gardening", ["2025-01-01", "2025-02-01", "2024-05-01"]),
      thread("Rain", ["2025-04-01", "2025-05-01", "2025-06-01"]),
      thread(null, ["2024-01-01", "2024-02-01"]),
    ]
    const [y, old] = yearReviews(notes, threads)
    expect(y.idea).toEqual({ title: "Rain", passages: 3 })
    // an untitled thread is named by its first passage's opening words
    expect(old.idea).toEqual({
      title: "the garden keeps coming back to…",
      passages: 2,
    })
  })
})
