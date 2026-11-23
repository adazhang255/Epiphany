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
  UNDERLINE,
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
      if (r.flags & UNDERLINE) t = `<u>${t}</u>`
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
})

describe("underline", () => {
  it("shows __words__ underlined, apart from italic and snake_case", () => {
    expect(shown("a __b c__ d")).toBe("a <u>b c</u> d")
    expect(shown("_a_ __b__")).toBe("<i>a</i> <u>b</u>")
    expect(shown("**__both__**")).toBe("<u><b>both</b></u>")
    for (const t of ["__init__x", "snake__case", "____", "__ x__"])
      expect(shown(t)).not.toContain("<u>")
  })
  it("leaves its markers out of highlights and snippets", () => {
    expect(stripInline("a __b__ c")).toBe("a b c")
    expect(stripInline("__cut off")).toBe("cut off")
  })
})

import { STRIKE, RULE, shownRuns } from "@/features/notes/lib/markdown"
import { smarten } from "@/features/notes/lib/smartPunctuation"

describe("strikethrough and dividers", () => {
  it("shows ~~words~~ struck through, markers hidden", () => {
    const t = "a ~~b c~~ d"
    const runs = formatRuns(t, formatFlags(t)).filter(
      (r) => !(r.flags & MARKER),
    )
    expect(runs.map((r) => r.text).join("")).toBe("a b c d")
    expect(runs.find((r) => r.text === "b c")!.flags & STRIKE).toBeTruthy()
    expect(stripInline(t)).toBe("a b c d")
  })
  it("a line of dashes is a divider, kept out of highlights", () => {
    for (const line of ["---", "-----", "***", "—-"]) {
      const t = `one\n${line}\ntwo`
      const f = formatFlags(t)
      expect(f[4] & RULE).toBeTruthy()
      expect(stripInline(t)).toBe("one\n\ntwo")
    }
    expect(formatFlags("a --- b")[2] & RULE).toBeFalsy()
    expect(shownRuns("---")[0]).toMatchObject({ rule: true, text: "⸻" })
  })
})

describe("punctuation as you type", () => {
  const type = (before: string, ch: string) => {
    const s = smarten(before, ch)
    return s
      ? before.slice(0, before.length - s.remove) + s.insert
      : before + ch
  }
  it("makes dashes, ellipses, arrows and symbols", () => {
    expect(type("a -", "-")).toBe("a —")
    expect(type("wait..", ".")).toBe("wait…")
    expect(type("a -", ">")).toBe("a →")
    expect(type("x <", "=")).toBe("x ≤")
    expect(type("(c", ")")).toBe("©")
    expect(type("(tm", ")")).toBe("™")
    // a third dash stays one, so "---" can still make a divider
    expect(type("—", "-")).toBe("—-")
  })
  it("curls quotes the right way", () => {
    expect(type("", '"')).toBe("“")
    expect(type("say “hi", '"')).toBe("say “hi”")
    expect(type("don", "'")).toBe("don’")
    expect(type("a (", "'")).toBe("a (‘")
  })
  it("leaves everything else alone", () => {
    for (const [b, c] of [
      ["a", "-"],
      ["1", "."],
      ["x", ">"],
      ["- ", "x"],
    ])
      expect(smarten(b, c)).toBeNull()
  })
})
