import { describe, expect, it } from "vitest"
import { entriesDocx } from "@/features/export/docx"
import { entriesHtml, entriesText, spanOf } from "@/features/export/html"
import { markAutoTitle } from "@/features/notes/lib/titles"

// a .docx is a zip; its text is in word/document.xml
async function documentXml(buffer: Buffer) {
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(buffer)
  return zip.file("word/document.xml")!.async("string")
}

const entries = [
  {
    title: "A <b>bold</b> day",
    date: new Date(2025, 0, 5),
    content: "One\ntwo\n\nThree & four",
  },
  { title: markAutoTitle("Fig"), date: new Date(2025, 2, 6), content: "Soil." },
]

describe("diary export", () => {
  it("covers the months the entries span", () => {
    expect(spanOf(entries)).toBe("January 2025 – March 2025")
    expect(spanOf([entries[0]])).toBe("January 2025")
  })

  it("formats a diary to preview and paste: date first, title, text, safely", () => {
    const html = entriesHtml(entries, "Journal")
    const date = html.indexOf("Sunday 5 January 2025")
    const title = html.indexOf("A &lt;b&gt;bold&lt;/b&gt; day")
    expect(date).toBeGreaterThan(0)
    expect(title).toBeGreaterThan(date)
    expect(html).toContain("One<br>two</p>")
    expect(html).toContain("Three &amp; four")
    // one size for the text; the date stands out by weight and colour
    expect(html).toMatch(
      /font-weight:bold;font-variant:small-caps[^"]*">Sunday 5 January 2025/,
    )
    expect(html).toContain("⁂")
    expect(html).not.toContain("<h1")
    expect(html).not.toContain("⁣")
  })

  it("writes plain text with the date in capitals", () => {
    expect(
      entriesText([{ title: "", date: new Date(2025, 0, 5), content: "Hi" }]),
    ).toBe("SUNDAY 5 JANUARY 2025\nUntitled thought\n\nHi")
  })

  it("makes a .docx with the same diary", async () => {
    const buf = await entriesDocx(entries, "Journal")
    expect(buf.subarray(0, 2).toString()).toBe("PK")
    const xml = await documentXml(buf)
    for (const text of [
      "Sunday 5 January 2025",
      "A &lt;b&gt;bold&lt;/b&gt; day",
      "One",
      "two",
      "Three &amp; four",
      "Soil.",
      "⁂",
    ])
      expect(xml).toContain(text)
    expect(xml).toContain("w:smallCaps")
    expect(xml).toContain("Fig<")
    expect(xml).not.toContain("⁣")
  })
})
