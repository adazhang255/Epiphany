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

// A colour from the slider: a hue (0–359), always at the same saturation and
// lightness, so every answer reads well on the dark page.
export function hueColor(hue: number) {
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
  if (d === 0) return 0
  const h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4
  return Math.round((h * 60 + 360) % 360)
}
