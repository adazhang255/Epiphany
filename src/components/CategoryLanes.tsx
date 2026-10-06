"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  categoryColor,
  categoryGlyph,
  PURPOSES,
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
} from "@/features/notes/lib/topics"

export type LaneEntry = {
  id: string
  title: string
  date: string // ISO
  category: string | null // main category
  sentiment: number | null // -2..2
}

type Range = "3m" | "12m" | "all"
type ColorBy = "category" | "tone"

const RANGES: { id: Range; label: string; months: number | null }[] = [
  { id: "3m", label: "3 months", months: 3 },
  { id: "12m", label: "12 months", months: 12 },
  { id: "all", label: "All", months: null },
]

const LABEL_W = 170
const LANE_H = 46
// two label rows above the lanes: month, then year
const AXIS_H = 40
const PAD_R = 8
// every month gets at least this much room; more months than fit scroll
const MONTH_MIN_W = 56
const SURFACE = "#161617"
const UNSET = "#5c5c57"
// Hollow dashed ring: no category / not scored yet. Shape, not just a grey,
// so it never passes for a neutral tone.
const UNSET_RING = "#8a8a82"
const DAY = 24 * 60 * 60 * 1000

function shortDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

// One lane per category, one dot per entry at its real date, in one column
// per calendar month: when you wrote, and what kind of writing it was.
export function CategoryLanes({
  entries,
  today,
}: {
  entries: LaneEntry[]
  // ISO "now" from the server, so server and browser draw the same chart
  today: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [colorBy, setColorBy] = useState<ColorBy>("category")
  const [hover, setHover] = useState<{
    entry: LaneEntry
    x: number
    y: number
  } | null>(null)

  const now = useMemo(() => new Date(today), [today])
  const hasRecent = entries.some(
    (e) => now.getTime() - new Date(e.date).getTime() < 365 * DAY,
  )
  const [range, setRange] = useState<Range>(hasRecent ? "12m" : "all")

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The months shown: the last 3 or 12 (this one included), or from the
  // first entry's month to this one.
  const months = useMemo(() => {
    const span = RANGES.find((r) => r.id === range)!.months
    const first = span
      ? new Date(now.getFullYear(), now.getMonth() - (span - 1), 1)
      : monthStart(
          new Date(
            Math.min(
              ...entries.map((e) => new Date(e.date).getTime()),
              now.getTime(),
            ),
          ),
        )
    const out: Date[] = []
    for (const m = new Date(first); m <= now; m.setMonth(m.getMonth() + 1))
      out.push(new Date(m))
    return out
  }, [range, now, entries])

  const startT = months[0].getTime()
  const endT = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
  const visible = entries.filter((e) => {
    const t = new Date(e.date).getTime()
    return t >= startT && t < endT
  })

  // fit the card, or give each month MONTH_MIN_W and scroll sideways
  const fitW = Math.max(100, width - LABEL_W - PAD_R)
  const plotW = Math.max(fitW, months.length * MONTH_MIN_W)
  const scrolls = plotW > fitW
  const x = (iso: string) =>
    ((new Date(iso).getTime() - startT) / (endT - startT)) * plotW

  // start at the newest months
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [range, plotW])

  // the four built-ins, then any categories of your own in this range
  const lanes = [
    ...[
      ...PURPOSES.map((p) => p.name as string),
      ...[...new Set(visible.map((e) => e.category).filter(Boolean))].filter(
        (c) => !PURPOSES.some((p) => p.name === c),
      ),
    ].map((name) => ({
      name: name as string,
      glyph: categoryGlyph(name as string),
      color: categoryColor(name as string),
    })),
    ...(visible.some((e) => !e.category)
      ? [{ name: "No category", glyph: "", color: UNSET }]
      : []),
  ]
  const laneOf = (e: LaneEntry) =>
    lanes.findIndex((l) => l.name === (e.category ?? "No category"))
  const height = AXIS_H + lanes.length * LANE_H

  // spread same-day entries in a lane so none hide behind another
  const seen = new Map<string, number>()
  const placed = visible.map((e) => {
    const lane = laneOf(e)
    const key = `${lane}-${e.date.slice(0, 10)}`
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    const offset = n === 0 ? 0 : (n % 2 ? -1 : 1) * Math.ceil(n / 2) * 13
    return {
      e,
      cx: x(e.date),
      cy: AXIS_H + lane * LANE_H + LANE_H / 2 + offset,
    }
  })

  const counts = lanes.map(
    (l) =>
      visible.filter((e) => (e.category ?? "No category") === l.name).length,
  )
  const top = Math.max(...counts)
  const leader = top > 0 ? lanes[counts.indexOf(top)] : null

  const unset = (e: LaneEntry) =>
    colorBy === "category" ? !e.category : e.sentiment === null
  const dotColor = (e: LaneEntry) =>
    colorBy === "category"
      ? e.category
        ? categoryColor(e.category)
        : UNSET
      : SENTIMENT_COLORS[e.sentiment ?? 0]

  const toggle = (active: boolean) =>
    `rounded-full px-3 py-1 ${active ? "bg-white/10 text-ink" : "text-stone-400 hover:text-stone-200"}`

  return (
    <section
      aria-labelledby="lanes-title"
      className="rounded-2xl border border-white/[0.07] bg-panel p-5"
    >
      {/* the controls stay anchored top right; the text wraps beside them */}
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <h2 id="lanes-title" className="font-serif text-xl text-ink">
            Categories over time
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            Every entry is a dot at the day you wrote it, in its category’s
            lane.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <div
            role="group"
            aria-label="Color dots by"
            className="inline-flex rounded-full border border-white/10 p-0.5 text-xs"
          >
            {(["category", "tone"] as ColorBy[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={colorBy === c}
                onClick={() => setColorBy(c)}
                className={toggle(colorBy === c)}
              >
                {c === "category" ? "Category" : "Tone"}
              </button>
            ))}
          </div>
          <div
            role="group"
            aria-label="Time range"
            className="inline-flex rounded-full border border-white/10 p-0.5 text-xs"
          >
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}
                className={toggle(range === r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {colorBy === "tone" && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {[-2, -1, 0, 1, 2].map((n) => (
            <li
              key={n}
              className="flex items-center gap-1.5 text-xs text-stone-400"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: SENTIMENT_COLORS[n] }}
              />
              {SENTIMENT_LABELS[n]}
            </li>
          ))}
          <li className="flex items-center gap-1.5 text-xs text-stone-400">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full border-[1.5px] border-dashed border-muted"
            />
            Not scored yet
          </li>
        </ul>
      )}

      {scrolls && (
        <p
          className="mt-3 font-mono text-[10px] uppercase tracking-widest text-stone-600"
          style={{ marginLeft: LABEL_W }}
        >
          ← scroll for earlier months
        </p>
      )}
      <div ref={wrap} className={`${scrolls ? "mt-1" : "mt-4"} flex`}>
        {/* lane names stay put while the months scroll */}
        <svg width={LABEL_W} height={height} aria-hidden className="shrink-0">
          {lanes.map((lane, i) => {
            const y = AXIS_H + i * LANE_H
            return (
              <g key={lane.name}>
                {lane.name === "No category" ? (
                  <circle
                    cx={10}
                    cy={y + LANE_H / 2}
                    r={4.5}
                    fill="none"
                    stroke={UNSET_RING}
                    strokeWidth={1.5}
                    strokeDasharray="2.5 2"
                  />
                ) : (
                  <circle cx={10} cy={y + LANE_H / 2} r={5} fill={lane.color} />
                )}
                <text
                  x={22}
                  y={y + LANE_H / 2}
                  dy="0.35em"
                  className="fill-stone-200 text-[13px]"
                >
                  {lane.glyph} {lane.name}
                </text>
                <text
                  x={LABEL_W - 12}
                  y={y + LANE_H / 2}
                  dy="0.35em"
                  textAnchor="end"
                  className="fill-stone-500 font-mono text-[11px]"
                >
                  {counts[i]}
                </text>
              </g>
            )
          })}
        </svg>

        <div
          ref={scroller}
          className="relative min-w-0 flex-1 overflow-x-auto"
          onMouseLeave={() => setHover(null)}
          onScroll={() => setHover(null)}
        >
          {visible.length === 0 && (
            <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-stone-500">
              No entries in this range.
            </p>
          )}
          <svg
            width={plotW}
            height={height}
            role="img"
            aria-label="Entries over time by category, one column per month"
            className="block"
          >
            {/* month columns, alternately shaded, each labelled */}
            {months.map((m, i) => {
              const x0 = x(m.toISOString())
              const next = new Date(m.getFullYear(), m.getMonth() + 1, 1)
              const x1 = Math.min(plotW, x(next.toISOString()))
              return (
                <g key={m.toISOString()}>
                  <rect
                    x={x0}
                    y={AXIS_H}
                    width={x1 - x0}
                    height={height - AXIS_H}
                    fill={
                      i % 2
                        ? "rgb(255 255 255 / 0.018)"
                        : "rgb(255 255 255 / 0.035)"
                    }
                  />
                  {m.getMonth() === 0 && i > 0 && (
                    <line
                      x1={x0}
                      x2={x0}
                      y1={4}
                      y2={height}
                      stroke="rgb(255 255 255 / 0.18)"
                    />
                  )}
                  <text
                    x={(x0 + x1) / 2}
                    y={16}
                    textAnchor="middle"
                    className="fill-stone-400 font-mono text-[10px] uppercase"
                  >
                    {m.toLocaleDateString("en-US", { month: "short" })}
                  </text>
                  {/* every month says its year (so a scrolled view does
                      too); January's stands out where a year begins */}
                  <text
                    x={(x0 + x1) / 2}
                    y={30}
                    textAnchor="middle"
                    className={`font-mono text-[10px] ${
                      m.getMonth() === 0 ? "fill-stone-400" : "fill-stone-700"
                    }`}
                  >
                    {m.getFullYear()}
                  </text>
                </g>
              )
            })}

            {/* lane separators */}
            {lanes.map((lane, i) =>
              i === 0 ? null : (
                <line
                  key={lane.name}
                  x1={0}
                  x2={plotW}
                  y1={AXIS_H + i * LANE_H}
                  y2={AXIS_H + i * LANE_H}
                  stroke="rgb(255 255 255 / 0.05)"
                />
              ),
            )}

            {/* today */}
            <line
              x1={x(now.toISOString())}
              x2={x(now.toISOString())}
              y1={AXIS_H}
              y2={height}
              stroke="rgb(232 194 122 / 0.5)"
              strokeDasharray="3 3"
            />

            {/* entries */}
            {placed.map(({ e, cx, cy }) => (
              <Link
                key={e.id}
                href={`/notes/${e.id}`}
                aria-label={`${e.title || "Untitled"}, ${shortDate(new Date(e.date))}, ${e.category ?? "no category"}`}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={hover?.entry.id === e.id ? 8 : unset(e) ? 5 : 6}
                  fill={unset(e) ? SURFACE : dotColor(e)}
                  stroke={unset(e) ? UNSET_RING : SURFACE}
                  strokeWidth={unset(e) ? 1.5 : 2}
                  strokeDasharray={unset(e) ? "2.5 2" : undefined}
                  className="cursor-pointer transition-[r]"
                  onMouseEnter={() => setHover({ entry: e, x: cx, y: cy })}
                  onFocus={() => setHover({ entry: e, x: cx, y: cy })}
                />
              </Link>
            ))}
          </svg>

          {hover && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/15 bg-stone-900/95 px-3 py-2 text-xs shadow-xl"
              style={{
                left: Math.min(Math.max(hover.x, 110), plotW - 110),
                top: hover.y - 12,
              }}
            >
              <p className="font-serif text-sm text-stone-100">
                {hover.entry.title || "Untitled thought"}
              </p>
              <p className="mt-0.5 font-mono text-stone-400">
                {shortDate(new Date(hover.entry.date))}
              </p>
              <p className="mt-1 text-stone-300">
                {hover.entry.category ?? "No category yet"}
                {" · "}
                {hover.entry.sentiment === null
                  ? "tone not scored yet"
                  : `${SENTIMENT_LABELS[hover.entry.sentiment].toLowerCase()} tone`}
              </p>
            </div>
          )}
        </div>
      </div>

      {leader && (
        <p className="mt-3 text-sm text-stone-300">
          {leader.name === "No category"
            ? `${top} of ${visible.length} entries in this range have no category yet.`
            : `${leader.name} leads this range: ${top} of ${visible.length} entries (${Math.round((top / visible.length) * 100)}%).`}
        </p>
      )}
    </section>
  )
}
