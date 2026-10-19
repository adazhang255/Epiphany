import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { prepareAnswer } from "@/features/ask/markdown"

// next/link needs the app router; a plain link is enough here
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}))
const { AnswerMarkdown } = await import("@/components/AnswerMarkdown")

const sources = [
  { n: 1, id: "e1", title: "Rain", date: "2026-03-02", category: "" },
  { n: 2, id: "e2", title: "Sea", date: "2026-04-02", category: "" },
]
const html = (text: string, pending = false) =>
  renderToStaticMarkup(
    createElement(AnswerMarkdown, { text, sources, pending }),
  )

describe("prepareAnswer", () => {
  it("turns citations into links, single or grouped", () => {
    expect(prepareAnswer("Yes [1], and later [1, 2].")).toBe(
      "Yes [1](#cite-1), and later [1, 2](#cite-1-2).",
    )
  })

  it("leaves citations inside code, and real links, alone", () => {
    expect(prepareAnswer("see `[1]` and [2](http://x)")).toBe(
      "see `[1]` and [2](http://x)",
    )
  })

  it("makes • bullets into list items", () => {
    expect(prepareAnswer("Themes:\n• rain\n  • sea")).toBe(
      "Themes:\n- rain\n  - sea",
    )
  })

  it("unwraps a reply put inside a markdown code block, even mid-stream", () => {
    expect(prepareAnswer("```markdown\n**Hi** [1]\n```")).toBe(
      "**Hi** [1](#cite-1)",
    )
    expect(prepareAnswer("```md\nHalf an ans")).toBe("Half an ans")
  })
})

describe("AnswerMarkdown", () => {
  it("renders bold, italics, lists and numbered lists", () => {
    const out = html(
      "You wrote about **rain** and *the sea*.\n\n- first\n- second\n\n1. March\n2. April",
    )
    expect(out).toContain("<strong")
    expect(out).toContain(">rain</strong>")
    expect(out).toContain("<em")
    expect(out).toMatch(/<ul[^>]*>\s*<li[^>]*>first<\/li>/)
    expect(out).toMatch(/<ol[^>]*>\s*<li[^>]*>March<\/li>/)
    expect(out).not.toContain("**")
  })

  it("renders a list that follows a line without a blank line", () => {
    expect(html("Two things:\n- one\n- two")).toMatch(/<ul/)
  })

  it("renders headings, quotes and tables", () => {
    const out = html(
      "### Then\n\n> a line you wrote\n\n| When | Mood |\n|---|---|\n| March | calm |",
    )
    expect(out).toMatch(/<h4[^>]*>Then<\/h4>/)
    expect(out).toContain("<blockquote")
    expect(out).toMatch(/<td[^>]*>calm<\/td>/)
  })

  it("links citations to their entries, and leaves unknown numbers as text", () => {
    const out = html("Calm [1][2], unclear [9].")
    expect(out).toContain('href="/notes/e1"')
    expect(out).toContain('href="/notes/e2"')
    expect(out).toContain("[9]")
    expect(out).not.toContain("#cite-")
  })

  it("keeps a line break inside a paragraph", () => {
    expect(html("Line one\nLine two")).toContain("whitespace-pre-line")
  })

  it("never runs HTML or loads images the model wrote", () => {
    const out = html("<script>alert(1)</script> ![a cat](http://x/cat.png)")
    expect(out).not.toContain("<script")
    expect(out).not.toContain("<img")
    expect(out).toContain("a cat")
  })

  it("shows the cursor at the end while the answer arrives", () => {
    expect(html("Still writ", true)).toMatch(
      /Still writ <span[^>]*animate-pulse/,
    )
    expect(html("Done")).not.toContain("animate-pulse")
  })
})
