import { describe, expect, it } from "vitest"
import {
  changePoints,
  compareBase,
  type SavedProfile,
} from "@/features/profile/profile"

const written = (iso: string): SavedProfile => ({
  markdown: `profile of ${iso}`,
  generatedAt: iso,
  entries: 10,
  read: 10,
})

describe("profile changes", () => {
  it("compares with the newest profile from about a month before", () => {
    const now = new Date("2026-11-06T12:00:00Z")
    const list = [
      written("2026-08-01T00:00:00Z"),
      written("2026-10-05T00:00:00Z"),
      written("2026-11-01T00:00:00Z"), // rewritten last week by hand
    ]
    expect(compareBase(list, now)?.generatedAt).toBe("2026-10-05T00:00:00Z")
    // none that old: the last one
    expect(
      compareBase([written("2026-11-01T00:00:00Z")], now)?.generatedAt,
    ).toBe("2026-11-01T00:00:00Z")
    expect(compareBase([], now)).toBeNull()
  })

  it("tidies the model's changes into a few whole sentences", () => {
    expect(
      changePoints([
        "- you write more about your sister now",
        "",
        "You worry less about work.",
        "word ".repeat(40),
        "a.",
        "b.",
        "c.",
      ]),
    ).toEqual([
      "You write more about your sister now.",
      "You worry less about work.",
      "A.",
      "B.",
    ])
    expect(changePoints("nope")).toEqual([])
  })
})
