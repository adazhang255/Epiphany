"use client"

import Link from "next/link"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  categoryColor,
  categoryGlyph,
  PURPOSES,
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
} from "@/features/notes/lib/topics"
import { EntryTitle } from "@/components/EntryTitle"
import { titleText } from "@/features/notes/lib/titles"

export type LaneEntry = {
  id: string
  title: string
  date: string // ISO
  category: string | null // main category
  sentiment: number | null // -2..2
}

type ColorBy = "category" | "tone"

const LABEL_W = 170
const LANE_H = 46
// two label rows above the lanes: month, then year
const AXIS_H = 40
const PAD_R = 8
// The whole journal fits the card at first; zooming in widens each month
// (up to MONTH_MAX_W, about 20 px a day) and the chart scrolls sideways.
const MONTH_MAX_W = 600
const ZOOM_STEP = 1.6
const SURFACE = "#161617"
const UNSET = "#5c5c57"
// Hollow dashed ring: no category / not scored yet. Shape, not just a grey,
// so it never passes for a neutral tone.
const UNSET_RING = "#8a8a82"

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
  // width of a month in px; null: fit the whole journal in the card
  const [zoom, setZoom] = useState<number | null>(null)
  // where to scroll once a zoom is drawn (keeps the spot you zoomed on still)
  const pendingScroll = useRef<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // every month from the first entry's to this one
  const months = useMemo(() => {
    const first = monthStart(
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
  }, [now, entries])

  const startT = months[0].getTime()
  const endT = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
  const visible = entries.filter((e) => {
    const t = new Date(e.date).getTime()
    return t >= startT && t < endT
  })

  // fit the card, or wider when zoomed in (then it scrolls sideways)
  const fitW = Math.max(100, width - LABEL_W - PAD_R)
  const fitMonthW = fitW / months.length
  const monthW = Math.min(
    Math.max(zoom ?? fitMonthW, fitMonthW),
    Math.max(MONTH_MAX_W, fitMonthW),
  )
  const plotW = months.length * monthW
  const scrolls = plotW > fitW + 1
  const x = (iso: string) =>
    ((new Date(iso).getTime() - startT) / (endT - startT)) * plotW

  // Zoom by `factor`, keeping the date at `at` px (from the view's left edge;
  // its middle by default) where it is.
  function zoomBy(factor: number, at?: number) {
    const el = scroller.current
    const view = el?.clientWidth ?? fitW
    const anchor = at ?? view / 2
    const frac = ((el?.scrollLeft ?? 0) + anchor) / plotW
    const next = Math.min(
      Math.max(monthW * factor, fitMonthW),
      Math.max(MONTH_MAX_W, fitMonthW),
    )
    pendingScroll.current = frac * next * months.length - anchor
    setZoom(next <= fitMonthW + 0.01 ? null : next)
  }
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && pendingScroll.current !== null) {
      el.scrollLeft = pendingScroll.current
      pendingScroll.current = null
    }
  }, [plotW])

  // ⌘/Ctrl + scroll, or a trackpad pinch, zooms where the pointer is
  const zoomRef = useRef(zoomBy)
  useEffect(() => {
    zoomRef.current = zoomBy
  })
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const at = e.clientX - el.getBoundingClientRect().left
      // gentle for a pinch, at most ×1.5 a step for a mouse wheel
      const step = Math.max(-0.4, Math.min(0.4, -e.deltaY * 0.005))
      zoomRef.current(Math.exp(step), at)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

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
            aria-label="Zoom"
            className="inline-flex rounded-full border border-white/10 p-0.5 text-xs"
          >
            <button
              type="button"
              onClick={() => zoomBy(1 / ZOOM_STEP)}
              disabled={zoom === null}
              aria-label="Zoom out"
              className={`${toggle(false)} disabled:opacity-30`}
            >
              −
            </button>
            <button
              type="button"
              aria-pressed={zoom === null}
              onClick={() => setZoom(null)}
              title="Show your whole journal"
              className={toggle(zoom === null)}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={monthW >= MONTH_MAX_W}
              aria-label="Zoom in"
              className={`${toggle(false)} disabled:opacity-30`}
            >
              +
            </button>
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

      {(scrolls || months.length > 1) && (
        <p
          className="mt-3 font-mono text-[10px] uppercase tracking-widest text-stone-600"
          style={{ marginLeft: LABEL_W }}
        >
          scroll sideways to move · ⌘/Ctrl + scroll or pinch to zoom
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
              No entries yet.
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
                  {/* month names while there's room: short, then initials,
                      then none (zoom in to see them) */}
                  {monthW >= 14 && (
                    <text
                      x={(x0 + x1) / 2}
                      y={16}
                      textAnchor="middle"
                      className="fill-stone-400 font-mono text-[10px] uppercase"
                    >
                      {m.toLocaleDateString("en-US", {
                        month: monthW >= 30 ? "short" : "narrow",
                      })}
                    </text>
                  )}
                  {/* every month says its year while there's room (so a
                      zoomed-in view does too); otherwise just where each year
                      begins */}
                  {(monthW >= 40 || m.getMonth() === 0 || i === 0) && (
                    <text
                      x={monthW >= 40 ? (x0 + x1) / 2 : x0 + 3}
                      y={monthW >= 14 ? 30 : 16}
                      textAnchor={monthW >= 40 ? "middle" : "start"}
                      className={`font-mono text-[10px] ${
                        m.getMonth() === 0 || monthW < 40
                          ? "fill-stone-400"
                          : "fill-stone-700"
                      }`}
                    >
                      {m.getFullYear()}
                    </text>
                  )}
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
                aria-label={`${titleText(e.title)}, ${shortDate(new Date(e.date))}, ${e.category ?? "no category"}`}
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
                <EntryTitle title={hover.entry.title} />
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
            ? `${top} of ${visible.length} entries have no category yet.`
            : `${leader.name} leads overall: ${top} of ${visible.length} entries (${Math.round((top / visible.length) * 100)}%).`}
        </p>
      )}
    </section>
  )
}
