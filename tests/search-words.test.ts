import { describe, expect, it } from "vitest"
import {
  hasAllWords,
  searchByWords,
  searchWords,
} from "@/features/search/words"

describe("searchWords", () => {
  it("lowercases, splits on punctuation and drops one-letter words", () => {
    expect(searchWords("Rain, on a  TUESDAY!")).toEqual([
      "rain",
      "on",
      "tuesday",
    ])
  })

  it("keeps apostrophes and letters beyond English", () => {
    expect(searchWords("didn’t café")).toEqual(["didn’t", "café"])
  })
})

describe("hasAllWords", () => {
  it("needs every word, in any order and case", () => {
    expect(hasAllWords("The Sea was calm", ["calm", "sea"])).toBe(true)
    expect(hasAllWords("The sea was calm", ["sea", "storm"])).toBe(false)
  })
})

describe("searchByWords", () => {
  const notes = [
    {
      id: "a",
      title: "Moving day",
      content: "Boxes everywhere.",
      quotes: [{ id: "a1", quote: "Home is where the boxes are" }],
    },
    {
      id: "b",
      title: "Walk",
      content: "A long walk home by the river.",
      quotes: [{ id: "b1", quote: "The river was loud" }],
    },
  ]

  it("finds entries by title, content or highlight, in the order given", () => {
    const r = searchByWords("home", notes)
    expect(r.noteIds).toEqual(["a", "b"])
    expect([...r.highlightIds]).toEqual(["a1"])
    expect(r.byMeaning).toBe(false)
  })

  it("matches all words across an entry's title and content", () => {
    expect(searchByWords("walk river", notes).noteIds).toEqual(["b"])
    expect(searchByWords("moving river", notes).noteIds).toEqual([])
  })
})
