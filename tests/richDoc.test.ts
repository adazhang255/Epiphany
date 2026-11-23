import { describe, expect, it } from "vitest"
import { parseText, serializeDoc } from "@/features/notes/lib/richDoc"

const round = (t: string) => serializeDoc(parseText(t)).text

describe("the rich editor's document", () => {
  it("reads an entry's text and writes it back the same", () => {
    for (const t of [
      "",
      "plain words",
      "a **bold** and *italic* and _also_ and __under__ and ~~gone~~",
      "**bold with _italic_ inside**",
      "# Day one\n## Smaller\n### Smallest\nplain",
      "> a quote\n>tight quote",
      "- one\n* two\n  - nested",
      "1. first\n2) second\n10. tenth",
      "before\n---\n***\nafter",
      "\n\nblank lines\n\n",
      "2*3*4 and snake_case and a * b",
      "“curly” — dashes… →",
    ])
      expect(round(t)).toBe(t)
  })
  it("keeps spaces outside a mark's markers", () => {
    const doc = parseText("a **b** c")
    expect(serializeDoc(doc).text).toBe("a **b** c")
  })
  it("maps places in the text to places in the editor and back", () => {
    const t = "a **bold** word\n# Head"
    const { text, toPos, startAt, endAt } = serializeDoc(parseText(t))
    expect(text).toBe(t)
    // "bold" starts at 4 in the text; in the editor after "a " (pos 1+2)
    const p = toPos[4]
    expect(p).toBe(3)
    expect(startAt[p]).toBe(4)
    // its end: before the closing "**"
    expect(endAt[toPos[8]]).toBe(8)
    // the heading's words start after "# "
    const h = text.indexOf("Head")
    expect(startAt[toPos[h]]).toBe(h)
  })
})
