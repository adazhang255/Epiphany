import { describe, expect, it } from "vitest"
import {
  cleanLegend,
  PALETTE,
  SCALE_COLORS,
  scaleColors,
  colorHue,
  GREY,
  GREY_FROM,
  hueColor,
  SLIDER_MAX,
  cleanScale,
  formatScale,
  parseLegend,
  scaleColor,
  scaleValue,
  storeLegend,
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
    // grey: the band past the hues, and back there again
    expect(hueColor(GREY_FROM)).toBe(GREY)
    expect(hueColor(SLIDER_MAX)).toBe(GREY)
    expect(hueColor(colorHue(GREY))).toBe(GREY)
  })
})

describe("tracker scales", () => {
  const sleep = cleanScale({
    min: 0,
    max: 12,
    step: 0.5,
    unit: "hours",
    low: { label: "None", color: "#000000" },
    high: { label: "Plenty", color: "#ffffff" },
  })!

  it("needs ends that make a range", () => {
    expect(cleanScale({ min: 5, max: 5 })).toBeNull()
    expect(cleanScale({ min: "", max: 10 })).toBeNull()
    expect(cleanScale(null)).toBeNull()
    // a step bigger than the range: the whole range
    expect(cleanScale({ min: 0, max: 2, step: 5 })!.step).toBe(2)
  })

  it("keeps answers inside the scale, on its steps", () => {
    expect(scaleValue(sleep, "7.3")).toBe(7.5)
    expect(scaleValue(sleep, 12)).toBe(12)
    expect(scaleValue(sleep, "13")).toBeNull()
    expect(scaleValue(sleep, "-1")).toBeNull()
    expect(scaleValue(sleep, "good")).toBeNull()
    expect(scaleValue(sleep, "")).toBeNull()
  })

  it("takes any number in range, with no step", () => {
    const any = cleanScale({ min: 0, max: 10, step: 0 })!
    expect(any.step).toBe(0)
    expect(scaleValue(any, "1.3")).toBe(1.3)
    expect(scaleValue(any, "2.345")).toBe(2.35)
    expect(scaleValue(any, "11")).toBeNull()
    expect(formatScale(any, 1.3)).toBe("1.3")
    expect(formatScale(any, 4)).toBe("4")
  })

  it("writes numbers with the unit, without needless decimals", () => {
    expect(formatScale(sleep, 7.5)).toBe("7.5 hours")
    expect(formatScale(sleep, 8)).toBe("8 hours")
    expect(formatScale(cleanScale({ min: 1, max: 10 })!, 10)).toBe("10")
  })

  it("colours a day part way between the ends", () => {
    expect(scaleColor(sleep, 0)).toBe("#000000")
    expect(scaleColor(sleep, 12)).toBe("#ffffff")
    expect(scaleColor(sleep, 6)).toBe("#808080")
  })

  it("is stored in the tracker's legend and read back", () => {
    expect(parseLegend(storeLegend({ scale: sleep }))).toEqual({
      legend: [],
      scale: sleep,
    })
    const answers = cleanLegend(["Low", "High"])
    expect(parseLegend(storeLegend({ legend: answers }))).toEqual({
      legend: answers,
      scale: null,
    })
  })
})
