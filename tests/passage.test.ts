import { describe, expect, it } from "vitest"
import { clampPassage, shortPassage } from "@/features/notes/lib/passage"

describe("clampPassage", () => {
  it("keeps at most two sentences", () => {
    expect(clampPassage("One. Two! Three? Four.")).toBe("One. Two!")
  })
  it("cuts at a word when there's no sentence end in reach", () => {
    const long = "word ".repeat(80).trim()
    const cut = clampPassage(long)
    expect(cut.length).toBeLessThanOrEqual(220)
    expect(long.startsWith(cut)).toBe(true)
    expect(cut.endsWith("word")).toBe(true)
  })
})

describe("shortPassage", () => {
  it("leaves a short highlight whole", () => {
    expect(shortPassage("The sea was calm.")).toEqual({
      text: "The sea was calm.",
      cut: false,
    })
  })
  it("marks a long one as cut", () => {
    const r = shortPassage("One. Two. Three.")
    expect(r).toEqual({ text: "One. Two", cut: true })
  })
})
