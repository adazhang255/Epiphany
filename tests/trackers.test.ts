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
  cleanRemap,
  groupOf,
  groupScale,
  stepCount,
  scaleEnds,
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

describe("a scale turned into answers", () => {
  const whole = cleanScale({ min: 1, max: 5, step: 1 })!
  const tenths = cleanScale({ min: 1, max: 10, step: 0, unit: "h" })!

  it("gives each number its own answer on a short stepped scale", () => {
    expect(stepCount(whole)).toBe(5)
    const g = groupScale(whole, 5)
    expect(g.map((x) => x.label)).toEqual(["1", "2", "3", "4", "5"])
    expect(groupOf(g, 4)?.label).toBe("4")
    // coloured as the scale colours them
    expect(g[0].color).toBe(scaleColor(whole, 1))
  })

  it("groups whole steps evenly, every number in one group", () => {
    const steps = cleanScale({ min: 1, max: 10, step: 1 })!
    expect(stepCount(steps)).toBeNull()
    const g = groupScale(steps, 3)
    expect(g.map((x) => x.label)).toEqual(["1–3", "4–6", "7–10"])
    for (let n = 1; n <= 10; n++) expect(groupOf(g, n)).toBeDefined()
    expect(groupOf(g, 3)?.key).toBe(g[0].key)
    expect(groupOf(g, 10)?.key).toBe(g[2].key)
  })

  it("splits any-number scales into stretches, ends included", () => {
    expect(stepCount(tenths)).toBeNull()
    const g = groupScale(tenths, 3)
    expect(g.map((x) => x.label)).toEqual(["1–4 h", "4–7 h", "7–10 h"])
    expect(groupOf(g, 1)?.key).toBe(g[0].key)
    // a boundary goes to the stretch it starts
    expect(groupOf(g, 4)?.key).toBe(g[1].key)
    expect(groupOf(g, 6.99)?.key).toBe(g[1].key)
    expect(groupOf(g, 10)?.key).toBe(g[2].key)
    // the answers are a usable legend
    expect(cleanLegend(g)).toHaveLength(3)
  })

  it("takes a remap of answers, clearing what isn't one", () => {
    expect(cleanRemap({ "gym-1": "3", "worked-0": null, x: 5 })).toEqual({
      "gym-1": "3",
      "worked-0": null,
      x: null,
    })
    expect(cleanRemap(["a"])).toBeNull()
    expect(cleanRemap(null)).toBeNull()
  })
})

describe("a scale in one colour", () => {
  const base = { min: 0, max: 10, high: { label: "", color: "#5598e7" } }
  const lum = (hex: string) =>
    [1, 3, 5].reduce((n, i) => n + parseInt(hex.slice(i, i + 2), 16), 0)

  it("keeps two colours unless asked, and remembers the choice", () => {
    expect(cleanScale(base)!.style).toBe("blend")
    expect(cleanScale({ ...base, style: "nonsense" })!.style).toBe("blend")
    const fade = cleanScale({ ...base, style: "fade" })!
    expect(parseLegend(storeLegend({ scale: fade })).scale!.style).toBe("fade")
  })

  it("fades from faint to the full colour", () => {
    const fade = cleanScale({ ...base, style: "fade" })!
    const [low, high] = scaleEnds(fade)
    expect(high).toBe("#5598e7")
    expect(lum(low)).toBeLessThan(lum(high))
    expect(scaleColor(fade, 10)).toBe("#5598e7")
    expect(scaleColor(fade, 0)).toBe(low)
  })

  it("goes from light to dark, the low end's own colour unused", () => {
    const shade = cleanScale({
      ...base,
      style: "shade",
      low: { label: "", color: "#ff0000" },
    })!
    const [low, high] = scaleEnds(shade)
    expect(lum(low)).toBeGreaterThan(lum("#5598e7"))
    expect(lum(high)).toBeLessThan(lum("#5598e7"))
    expect(scaleColor(shade, 5)).not.toMatch(/^#ff/)
  })
})
