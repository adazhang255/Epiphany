import { describe, expect, it } from "vitest"
import {
  cleanLegend,
  PALETTE,
  SCALE_COLORS,
  scaleColors,
  colorHue,
  hueColor,
} from "@/features/trackers/legend"

describe("tracker legends", () => {
  it("tidies answers: trims, drops blanks and repeats, keeps order", () => {
    const legend = cleanLegend([
      "  Low ",
      "",
      "Okay",
      "okay",
      { label: "Good", color: "#123456" },
    ])
    expect(legend.map((l) => l.label)).toEqual(["Low", "Okay", "Good"])
    expect(legend[2].color).toBe("#123456")
    // made-up colours are replaced with ones from the palette
    expect(cleanLegend([{ label: "A", color: "red" }])[0].color).toBe(
      PALETTE[0],
    )
  })

  it("keeps a saved answer's key (so its days stay marked when it's renamed)", () => {
    expect(cleanLegend([{ key: "good-2", label: "Great" }])[0].key).toBe(
      "good-2",
    )
    expect(cleanLegend(["Very good"])[0].key).toBe("very-good-0")
  })

  it("has at most nine answers", () => {
    expect(
      cleanLegend(Array.from({ length: 15 }, (_, i) => `a${i}`)),
    ).toHaveLength(9)
  })

  it("spreads a scale's colours from low to high", () => {
    expect(scaleColors(2)).toEqual([SCALE_COLORS[0], SCALE_COLORS[4]])
    expect(scaleColors(5)).toEqual(SCALE_COLORS)
    expect(scaleColors(3)).toEqual([
      SCALE_COLORS[0],
      SCALE_COLORS[2],
      SCALE_COLORS[4],
    ])
  })
})

describe("the colour slider", () => {
  it("gives a colour for each hue, and finds a colour's place again", () => {
    for (const hue of [0, 45, 120, 200, 300, 359]) {
      const color = hueColor(hue)
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
      expect(Math.abs(colorHue(color) - hue)).toBeLessThanOrEqual(2)
    }
    expect(hueColor(0)).not.toBe(hueColor(180))
  })
})
