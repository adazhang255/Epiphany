import { describe, expect, it } from "vitest"
import { cleanQuote } from "@/features/quotes/quotes"
import { quoteForDay } from "@/features/quotes/lib"

describe("kept quotes", () => {
  it("tidies a quote, without doubling its quote marks", () => {
    expect(
      cleanQuote({
        text: "  “Tell me, what is it you plan to do?”  ",
        author: " — Mary  Oliver ",
        source: "The Summer Day",
      }),
    ).toEqual({
      text: "Tell me, what is it you plan to do?",
      author: "Mary Oliver",
      source: "The Summer Day",
      note: "",
    })
    expect(cleanQuote({ text: "   " })).toBeNull()
    expect(cleanQuote(null)).toBeNull()
  })

  it("picks the same quote all day, and not always the same one", () => {
    const list = ["a", "b", "c", "d", "e"]
    expect(quoteForDay(list, "2026-11-06")).toBe(
      quoteForDay(list, "2026-11-06"),
    )
    const week = new Set(
      ["01", "02", "03", "04", "05", "06", "07"].map((d) =>
        quoteForDay(list, `2026-11-${d}`),
      ),
    )
    expect(week.size).toBeGreaterThan(1)
    expect(quoteForDay([], "2026-11-06")).toBeNull()
  })
})
