import { describe, expect, it, vi } from "vitest"

// A lazy model: it reports where only the first 3 entries in the text it's
// shown begin (as small local models do with long text), titles them all
// "T", and never finds a date.
vi.mock("@/features/notes/services/ollama.service", () => ({
  chatJSON: vi.fn(async (system: string, user: string) => {
    if (!system.includes("firstWords")) return { title: "T", date: "" }
    const starts = user
      .split("\n\n")
      .map((p) => p.trim())
      .filter((p) => p.startsWith("Entry"))
      .slice(0, 3)
      .map((p) => ({ firstWords: p.split(" ").slice(0, 7).join(" ") }))
    return { entries: starts }
  }),
}))
const { proposeEntries } = await import("@/features/import/ingest")

const doc = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    `Entry ${i + 1} begins here with its own words. ${"Something happened and I wrote it down at length. ".repeat(6)}`.trim(),
  ).join("\n\n")

describe("importing a document without headings or dates", () => {
  it("finds every entry, however few the model lists at a time", async () => {
    const entries = await proposeEntries(doc(25), "fake")
    expect(entries).toHaveLength(25)
    entries.forEach((e, i) =>
      expect(e.content.startsWith(`Entry ${i + 1} begins`)).toBe(true),
    )
  })

  it("keeps the document's text exactly, cut only between entries", async () => {
    const text = doc(12)
    const entries = await proposeEntries(text, "fake")
    expect(entries.map((e) => e.content).join("\n\n")).toBe(text)
  })
})
