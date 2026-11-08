import { describe, expect, it } from "vitest"
import {
  BOLD,
  BULLET,
  HEADING,
  ITALIC,
  MARKER,
  QUOTE,
  QUOTE_MARK,
  SUBHEADING,
  formatFlags,
  formatRuns,
  plainText,
  quoteIn,
  stripInline,
  stripRange,
} from "@/features/notes/lib/markdown"
import { findQuote } from "@/features/notes/lib/findQuote"

const shown = (text: string) =>
  formatRuns(text, formatFlags(text))
    .filter((r) => !(r.flags & MARKER))
    .map((r) => {
      let t = r.flags & BULLET ? "•" : r.text
      if (r.flags & BOLD) t = `<b>${t}</b>`
      if (r.flags & ITALIC) t = `<i>${t}</i>`
      return t
    })
    .join("")

describe("formatting", () => {
  it("bold, italic and both", () => {
    expect(shown("a **b** c")).toBe("a <b>b</b> c")
    expect(shown("a *b* _c_")).toBe("a <i>b</i> <i>c</i>")
    expect(shown("*a **b** c*")).toBe("<i>a </i><i><b>b</b></i><i> c</i>")
  })
  it("bullets", () => {
    expect(shown("- one\n* two\n-not")).toBe("• one\n• two\n-not")
  })
  it("leaves lone stars and snake_case alone", () => {
    for (const t of ["2*3*4", "a * b * c", "snake_case_name", "**", "** x**"])
      expect(shown(t)).toBe(t)
  })
  it("keeps one formatted line from running into the next", () => {
    expect(shown("**a\nb**")).toBe("**a\nb**")
  })
  it("strips markers for highlights and snippets", () => {
    expect(stripInline("is **very** *good*")).toBe("is very good")
    expect(stripInline("**cut off")).toBe("cut off")
    expect(plainText("- **one**\n- two")).toBe("• one\n• two")
  })
  it("strips a piece of the text using the whole text's markers", () => {
    const text = "Today was **very** good, *truly*."
    const start = text.indexOf("very")
    const end = text.indexOf("truly") + 5
    expect(stripRange(text, start, end)).toBe("very good, truly")
    expect(quoteIn(text, "very** good, *truly")).toBe("very good, truly")
  })
  it("finds a highlight kept without markers", () => {
    const text = "It is **very**, *truly* good."
    const r = findQuote(text, "is very, truly good")!
    expect(text.slice(r.start, r.end)).toBe("is **very**, *truly* good")
  })
  it("keeps every character, so places on screen match the text", () => {
    const t = "- **a** *b*\nc"
    expect(
      formatRuns(t, formatFlags(t))
        .map((r) => r.text)
        .join(""),
    ).toBe(t)
  })
})

import {
  continueList,
  cycleHeading,
  toggleBullets,
  toggleLines,
  toggleWrap,
  type TextEdit,
} from "@/features/notes/lib/markdownEdit"

// "[" and "]" in the text mark the selection, before and after the edit
function after(
  t: string,
  edit: (v: string, s: number, e: number) => TextEdit | null,
) {
  const s = t.indexOf("[")
  const e = t.indexOf("]") - 1
  const v = t.replace("[", "").replace("]", "")
  const ed = edit(v, s, e)
  if (!ed) return null
  const out = v.slice(0, ed.start) + ed.insert + v.slice(ed.end)
  return `${out.slice(0, ed.from)}[${out.slice(ed.from, ed.to)}]${out.slice(ed.to)}`
}
const bold = (v: string, s: number, e: number) => toggleWrap(v, s, e, "**")
const italic = (v: string, s: number, e: number) => toggleWrap(v, s, e, "*")

describe("formatting buttons", () => {
  it("bold and italic wrap the selection, and unwrap it", () => {
    expect(after("a [word ]b", bold)).toBe("a **[word]** b")
    expect(after("a **[word]** b", bold)).toBe("a [word] b")
    expect(after("a [**word**] b", bold)).toBe("a [word] b")
    expect(after("a *[word]* b", italic)).toBe("a [word] b")
    // italic inside bold doesn't take bold's stars for its own
    expect(after("**[word]**", italic)).toBe("***[word]***")
    expect(after("a[]b", bold)).toBe("a**[]**b")
  })
  it("bullets on the selected lines, and off again", () => {
    expect(after("x\n[one\ntwo]\ny", toggleBullets)).toBe(
      "x\n[- one\n- two]\ny",
    )
    expect(after("[- one\n- two]", toggleBullets)).toBe("[one\ntwo]")
    expect(after("a\n[]", toggleBullets)).toBe("a\n- []")
  })
  it("Enter continues a list, and ends it on an empty bullet", () => {
    expect(after("- one[]", continueList)).toBe("- one\n- []")
    expect(after("- one\n- []", continueList)).toBe("- one\n[]")
    expect(after("plain[]", continueList)).toBeNull()
  })
})

describe("headings and quotes", () => {
  const show = (text: string) =>
    formatRuns(text, formatFlags(text))
      .filter((r) => !(r.flags & MARKER))
      .map((r) => {
        if (r.flags & QUOTE_MARK) return "|"
        let t = r.flags & BULLET ? "•" : r.text
        if (r.flags & BOLD) t = `<b>${t}</b>`
        if (r.flags & HEADING) t = `<h1>${t}</h1>`
        if (r.flags & SUBHEADING) t = `<h2>${t}</h2>`
        if (r.flags & QUOTE) t = `<q>${t}</q>`
        return t
      })
      .join("")
  it("shows them, markers hidden", () => {
    expect(show("# Day one\nplain")).toBe("<h1>Day one</h1>\nplain")
    expect(show("## Later\n### Smaller")).toBe(
      "<h2>Later</h2>\n<h2>Smaller</h2>",
    )
    expect(show("> she said **this**")).toBe(
      "|<q>she said </q><q><b>this</b></q>",
    )
    expect(show("#hashtag and a > b")).toBe("#hashtag and a > b")
  })
  it("keeps headings and quotes out of highlights and snippets", () => {
    const text = "# Day one\n> It was **good**."
    expect(stripInline(text)).toBe("Day one\nIt was good.")
    expect(quoteIn(text, "Day one It was good")).toBe("Day one\nIt was good")
  })
  it("the heading button steps # → ## → none; quote toggles", () => {
    expect(after("[Title]", cycleHeading)).toBe("[# Title]")
    expect(after("[# Title]", cycleHeading)).toBe("[## Title]")
    expect(after("[## Title]", cycleHeading)).toBe("[Title]")
    expect(after("[a\nb]", (v, s, e) => toggleLines(v, s, e, "quote"))).toBe(
      "[> a\n> b]",
    )
    expect(
      after("[> a\n> b]", (v, s, e) => toggleLines(v, s, e, "quote")),
    ).toBe("[a\nb]")
  })
})
