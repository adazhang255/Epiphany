import { describe, expect, it } from "vitest"
import { entriesDocx } from "@/features/export/docx"
import { markAutoTitle } from "@/features/notes/lib/titles"

// a .docx is a zip; its text is in word/document.xml
async function documentXml(buffer: Buffer) {
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(buffer)
  return zip.file("word/document.xml")!.async("string")
}

describe("entriesDocx", () => {
  it("writes each entry's title, date and text", async () => {
    const buf = await entriesDocx(
      [
        {
          title: "Rain",
          date: new Date(2025, 0, 5),
          content: "First line.\nSecond line.\n\nNew paragraph.",
        },
        {
          title: markAutoTitle("Fig rescue"),
          date: new Date(2025, 0, 6),
          content: "Soil everywhere.",
        },
      ],
      "Journal",
    )
    expect(buf.subarray(0, 2).toString()).toBe("PK")
    const xml = await documentXml(buf)
    for (const text of [
      "Rain",
      "Sunday, January 5, 2025",
      "First line.",
      "Second line.",
      "New paragraph.",
      "Soil everywhere.",
    ])
      expect(xml).toContain(text)
    // a temporary title is exported as plain text
    expect(xml).toContain("Fig rescue<")
    expect(xml).not.toContain("⁣")
  })
})
