import { describe, expect, it } from "vitest"
import {
  AUTO_TITLE_MARK,
  isAutoTitle,
  isUntitled,
  markAutoTitle,
  plainTitle,
  titleText,
} from "@/features/notes/lib/titles"
import { cleanTitle } from "@/features/notes/services/title-queue"

describe("temporary titles", () => {
  it("marks a generated title invisibly, and reads it back", () => {
    const t = markAutoTitle("Quiet morning walk")
    expect(t).toBe(`Quiet morning walk${AUTO_TITLE_MARK}`)
    expect(isAutoTitle(t)).toBe(true)
    expect(plainTitle(t)).toBe("Quiet morning walk")
    expect(isAutoTitle("Quiet morning walk")).toBe(false)
  })

  it("knows which entries still need one", () => {
    for (const t of ["", "  ", "Untitled thought", "A thought"])
      expect(isUntitled(t)).toBe(true)
    expect(isUntitled("My title")).toBe(false)
    expect(isUntitled(markAutoTitle("Walk"))).toBe(false)
  })

  it("gives plain text for labels", () => {
    expect(titleText(markAutoTitle("Walk"))).toBe("Walk")
    expect(titleText("")).toBe("Untitled thought")
  })

  it("tidies what the model writes", () => {
    expect(cleanTitle('  "A Long Day at Work."  ')).toBe("A Long Day at Work")
    expect(cleanTitle("Rain\nand  more rain!")).toBe("Rain and more rain")
    expect(cleanTitle(undefined)).toBe("")
    expect(cleanTitle("fig tree rescue mission")).toBe("Fig tree rescue mission")
  })
})
