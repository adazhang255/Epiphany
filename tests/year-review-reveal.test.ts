import { describe, expect, it } from "vitest"
import { reviewable } from "@/features/insights/yearReview"

describe("when a year's review appears", () => {
  it("hides this year's review until December", () => {
    expect(reviewable(2026, new Date(2026, 10, 30))).toBe(false)
    expect(reviewable(2026, new Date(2026, 11, 1))).toBe(true)
  })
  it("always shows earlier years, never later ones", () => {
    expect(reviewable(2025, new Date(2026, 0, 1))).toBe(true)
    expect(reviewable(2027, new Date(2026, 11, 31))).toBe(false)
  })
})
