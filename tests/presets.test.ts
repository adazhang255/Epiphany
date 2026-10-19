import { describe, expect, it } from "vitest"
import type { InsightNote } from "@/features/insights/compute"
import {
  nextDeal,
  presetsFor,
  shuffled,
  SHOWN,
} from "@/features/insights/presets"
import { parseSpec } from "@/features/insights/spec"

const note = (date: string, text: string): InsightNote => ({
  id: date,
  title: "",
  date: `${date}T12:00:00`,
  words: 3,
  purposes: [],
  sentiment: null,
  topics: [],
  quotes: [],
  text,
})
const notes = [
  note("2026-10-01", "coffee coffee garden garden walking"),
  note("2025-03-01", "coffee garden walking"),
]
const now = new Date(2026, 9, 16)

describe("chart suggestions", () => {
  it("adds ones made from the entries", () => {
    const labels = presetsFor(notes, now).map((p) => p.label)
    expect(labels).toContain("Your key words, over time")
    expect(labels).toContain("How often you write “coffee”")
    expect(labels).toContain("This year, week by week")
    expect(labels).toContain("The last 30 days")
    expect(
      presetsFor([], now).some((p) => p.label.includes("key words")),
    ).toBe(false)
  })

  it("every suggestion makes a valid chart", () => {
    for (const p of presetsFor(notes, now))
      expect(() =>
        parseSpec({ ...p.spec, filter: p.spec.filter ?? {} }),
      ).not.toThrow()
  })

  it("orders them the same for the same seed, differently for another", () => {
    const all = presetsFor(notes, now)
    const label = (seed: number) =>
      shuffled(all, seed)
        .map((p) => p.label)
        .join("|")
    expect(label(0.42)).toBe(label(0.42))
    expect(label(0.42)).not.toBe(label(0.43))
  })

  it("shows every suggestion before any comes back, and never repeats the last set", () => {
    const all = presetsFor(notes, now)
    let deck = { order: shuffled(all, 0.1), at: 0 }
    const seen = new Set<string>()
    let last: string[] = []
    for (let i = 0; i < Math.floor(all.length / SHOWN); i++) {
      const shown = deck.order
        .slice(deck.at, deck.at + SHOWN)
        .map((p) => p.label)
      expect(shown).toHaveLength(SHOWN)
      shown.forEach((l) => seen.add(l))
      last = shown
      deck = nextDeal(deck, all, 0.5 + i / 100)
    }
    expect(seen.size).toBe(Math.floor(all.length / SHOWN) * SHOWN)
    // after a reshuffle, the next set isn't the one just shown
    for (let i = 0; i < 10; i++) {
      const shown = deck.order
        .slice(deck.at, deck.at + SHOWN)
        .map((p) => p.label)
      expect(shown).toHaveLength(SHOWN)
      expect(shown).not.toEqual(last)
      last = shown
      deck = nextDeal(deck, all, i / 10)
    }
  })
})
