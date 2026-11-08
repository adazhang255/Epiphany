// A tracker's legend: the answers you can give for a day, in order (for a
// scale, low to high). Shared by the server and the browser.

export type LegendItem = { key: string; label: string; color: string }

// colours to pick from: a scale (low red to high blue, like tone), then
// distinct ones for answers that aren't a scale
export const SCALE_COLORS = [
  "#e66767",
  "#c98a52",
  "#8a8a82",
  "#5c8fc7",
  "#5598e7",
]
export const PALETTE = [
  "#e8c27a",
  "#7aa2e8",
  "#e87a8c",
  "#7ae8b4",
  "#b47ae8",
  "#e8a07a",
  "#7ad8e8",
  "#c8e87a",
  "#8a8a82",
]

// n colours spread along the scale (2 → the ends, 5 → all of them)
export function scaleColors(n: number) {
  if (n <= 1) return [SCALE_COLORS[2]]
  return Array.from({ length: n }, (_, i) => {
    const at = (i / (n - 1)) * (SCALE_COLORS.length - 1)
    return SCALE_COLORS[Math.round(at)]
  })
}

const slug = (label: string, i: number) =>
  `${
    label
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "item"
  }-${i}`

// anything (a request, saved JSON, the model's answer) into 1–9 clean items
export function cleanLegend(raw: unknown): LegendItem[] {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const out: LegendItem[] = []
  for (const item of list) {
    const label = String((item as { label?: unknown })?.label ?? item ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40)
    if (!label || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    const color = String((item as { color?: unknown })?.color ?? "")
    const key = String((item as { key?: unknown })?.key ?? "").slice(0, 40)
    out.push({
      key: key || slug(label, out.length),
      label,
      color: /^#[0-9a-f]{6}$/i.test(color)
        ? color
        : PALETTE[out.length % PALETTE.length],
    })
    if (out.length === 9) break
  }
  return out
}

// Grey, for answers like "none" or "skipped": a band at the slider's end,
// past the hues (anything from GREY_FROM up).
export const GREY = "#8a8a82"
export const GREY_FROM = 360
export const SLIDER_MAX = 389

// A colour from the slider: a hue (0–359), always at the same saturation and
// lightness, so every answer reads well on the dark page; or grey, past them.
export function hueColor(hue: number) {
  if (hue >= GREY_FROM) return GREY
  const s = 0.62
  const l = 0.62
  const k = (n: number) => (n + hue / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

// where a colour sits on the slider (its hue)
export function colorHue(color: string) {
  const m = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return 0
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  // a grey (or nearly): in the grey band
  if (d < 0.08) return Math.round((GREY_FROM + SLIDER_MAX) / 2)
  const h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4
  return Math.round((h * 60 + 360) % 360)
}

// ---- a scale: any number in a range, instead of set answers ---------------
// ("How many hours did I sleep?" 0–12, "How was today?" 1–10). Each end has
// a label and a colour; a day's colour is part way between them.

export type ScaleEnd = { label: string; color: string }
export type Scale = {
  min: number
  max: number
  step: number // 0: any number in the range (kept to 2 decimals)
  unit: string
  low: ScaleEnd
  high: ScaleEnd
}

export const DEFAULT_SCALE: Scale = {
  min: 1,
  max: 10,
  step: 0,
  unit: "",
  low: { label: "Low", color: SCALE_COLORS[0] },
  high: { label: "High", color: SCALE_COLORS[4] },
}

const finite = (v: unknown, fallback: number) => {
  const n = typeof v === "string" && v.trim() === "" ? NaN : Number(v)
  return Number.isFinite(n) ? n : fallback
}
const hexOr = (v: unknown, fallback: string) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback
const end = (raw: unknown, fallback: ScaleEnd): ScaleEnd => {
  const r = (raw ?? {}) as Partial<ScaleEnd>
  return {
    label: String(r.label ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40),
    color: hexOr(r.color, fallback.color),
  }
}

// anything (a request, saved JSON) into a usable scale, or null if its ends
// don't make a range
export function cleanScale(raw: unknown): Scale | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const min = finite(r.min, NaN)
  const max = finite(r.max, NaN)
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null
  let step = Math.abs(finite(r.step, 1))
  if (step > max - min) step = max - min
  return {
    min,
    max,
    step,
    unit: String(r.unit ?? "")
      .trim()
      .slice(0, 20),
    low: end(r.low, DEFAULT_SCALE.low),
    high: end(r.high, DEFAULT_SCALE.high),
  }
}

// any value: this many decimals at most
const ANY_DECIMALS = 2

// how many decimals a scale's numbers need (from its step and ends)
const decimals = (scale: Scale) =>
  scale.step
    ? Math.min(
        4,
        Math.max(
          ...[scale.step, scale.min].map(
            (n) => (String(n).split(".")[1] ?? "").length,
          ),
        ),
      )
    : ANY_DECIMALS

// a day's answer (as stored, or typed) on the scale: within its ends, on its
// steps (if it has them); null if it isn't a number in range
export function scaleValue(scale: Scale, raw: unknown): number | null {
  const n = finite(raw, NaN)
  if (!Number.isFinite(n) || n < scale.min || n > scale.max) return null
  if (!scale.step) return Number(n.toFixed(ANY_DECIMALS))
  const stepped =
    scale.min + Math.round((n - scale.min) / scale.step) * scale.step
  return Number(Math.min(scale.max, stepped).toFixed(decimals(scale)))
}

// "7.5 hours"
export function formatScale(scale: Scale, value: number) {
  const fixed = value.toFixed(decimals(scale))
  // 7.50 → 7.5, 8.0 → 8 (but 10 stays 10)
  const n = fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed
  return scale.unit ? `${n} ${scale.unit}` : n
}

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// a value's colour: part way from the low end's colour to the high end's
export function scaleColor(scale: Scale, value: number) {
  const t = Math.max(
    0,
    Math.min(1, (value - scale.min) / (scale.max - scale.min)),
  )
  const a = rgb(scale.low.color)
  const b = rgb(scale.high.color)
  return `#${a
    .map((x, i) =>
      Math.round(x + (b[i] - x) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`
}

// What a tracker's stored `legend` holds: its answers (a list), or its scale
// ({ scale }).
export function parseLegend(json: string): {
  legend: LegendItem[]
  scale: Scale | null
} {
  try {
    const raw = JSON.parse(json)
    if (raw && !Array.isArray(raw) && typeof raw === "object") {
      const scale = cleanScale((raw as { scale?: unknown }).scale)
      if (scale) return { legend: [], scale }
    }
    return { legend: cleanLegend(raw), scale: null }
  } catch {
    return { legend: [], scale: null }
  }
}

export const storeLegend = (
  kind: { legend: LegendItem[] } | { scale: Scale },
) => JSON.stringify("scale" in kind ? { scale: kind.scale } : kind.legend)
