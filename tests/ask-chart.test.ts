import { describe, expect, it } from "vitest"
import { wantsChart } from "@/features/ask/chart"

describe("wantsChart", () => {
  it("starts a chart when one is asked for", () => {
    expect(wantsChart("Chart how often I mention coffee", false)).toBe(true)
    expect(wantsChart("can you graph my words per month?", false)).toBe(true)
    expect(wantsChart("visualize my moods", false)).toBe(true)
    expect(
      wantsChart(
        "Keyword Frequency by keyword over time for most interesting keywords",
        false,
      ),
    ).toBe(true)
    expect(wantsChart("how often do I mention Priya by month", false)).toBe(
      true,
    )
  })

  it("leaves ordinary questions to the normal answers", () => {
    expect(wantsChart("What did I write about my sister?", false)).toBe(false)
    expect(wantsChart("make it a line", false)).toBe(false)
  })

  it("treats a short change as changing the chart on screen", () => {
    expect(wantsChart("make it a line", true)).toBe(true)
    expect(wantsChart("split by keyword and add tea", true)).toBe(true)
    expect(wantsChart("only 2025, by week", true)).toBe(true)
  })

  it("goes back to answering when the next message is a question", () => {
    expect(wantsChart("What did I write about my sister?", true)).toBe(false)
  })
})
