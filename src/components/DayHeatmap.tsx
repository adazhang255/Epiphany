"use client"

import { BASE_PATH } from "@/lib/site-mode"
import { useMemo, useState } from "react"
import {
  categoryColor,
  categoryGlyph,
  PURPOSES,
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
} from "@/features/notes/lib/topics"

export type HeatmapDay = {
  entries: number
  words: number // written that day, across its entries
  // the day's most frequent highlight type (one color per day), or null if
  // the day has no highlights yet
  category: string | null
  // how many of the day's highlights were of each type
  categories: Record<string, number>
  // average tone of the day's entries, -2..2, or null if not scored yet
  sentiment: number | null
}

type Mode = "category" | "sentiment"

const CELL = 12
const GAP = 3
const UNSET = "#5c5c57"
// Not categorized / not scored yet: a hollow dashed square, so it never
// passes for the solid grey of a neutral tone.
const UNSET_STYLE = {
  background: "transparent",
  outline: "1.5px dashed #8a8a82",
  outlineOffset: "-1.5px",
}
const EMPTY = "rgb(255 255 255 / 0.05)"
const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""]

function key(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// Sunday-first week columns covering a calendar year, GitHub style.
function buildYear(year: number) {
  const start = new Date(year, 0, 1)
  start.setDate(start.getDate() - start.getDay())
  const weeks: (Date | null)[][] = []
  const cursor = new Date(start)
  while (cursor.getFullYear() <= year) {
    const week: (Date | null)[] = []
    for (let i = 0; i < 7; i++) {
      week.push(cursor.getFullYear() === year ? new Date(cursor) : null)
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

// How much you reflected that day, as the square's opacity: the busiest day
// of the year is solid, a few words stay faint but visible. (Square root, so
// one very long day doesn't wash out the rest.)
function density(words: number, most: number) {
  return 0.3 + 0.7 * Math.sqrt(Math.min(1, words / Math.max(1, most)))
}

function sentimentStep(value: number) {
  return Math.max(-2, Math.min(2, Math.round(value)))
}

function isUnset(day: HeatmapDay | undefined, mode: Mode) {
  if (!day) return false
  return mode === "category" ? !day.category : day.sentiment === null
}

function dayColor(day: HeatmapDay | undefined, mode: Mode) {
  if (!day) return EMPTY
  if (mode === "category") {
    return day.category ? categoryColor(day.category) : UNSET
  }
  return day.sentiment === null
    ? UNSET
    : SENTIMENT_COLORS[sentimentStep(day.sentiment)]
}

// One square per day, one color per square: the day's category, or its tone.
export function DayHeatmap({
  days,
  title = "Day by day",
  nav,
}: {
  days: Record<string, HeatmapDay>
  // its heading ("Your writing" among the trackers on the overview)
  title?: string
  // the slideshow's arrows: one each side of the grid
  nav?: { prev: React.ReactNode; next: React.ReactNode }
}) {
  const years = useMemo(
    () =>
      Array.from(
        new Set(Object.keys(days).map((k) => Number(k.slice(0, 4)))),
      ).sort((a, b) => b - a),
    [days],
  )
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear())
  const [mode, setMode] = useState<Mode>("category")
  const [focus, setFocus] = useState<string | null>(null)
  const [hover, setHover] = useState<{
    key: string
    x: number
    y: number
  } | null>(null)

  const weeks = useMemo(() => buildYear(year), [year])
  const yearDays = Object.entries(days).filter(([k]) =>
    k.startsWith(`${year}-`),
  )
  const entryCount = yearDays.reduce((sum, [, d]) => sum + d.entries, 0)
  const mostWords = Math.max(1, ...yearDays.map(([, d]) => d.words))
  const hovered = hover ? days[hover.key] : null

  const legend =
    mode === "category"
      ? [
          // the four built-ins, then any of your own that appear
          ...[
            ...PURPOSES.map((p) => p.name as string),
            ...[
              ...new Set(
                Object.values(days).flatMap((d) => Object.keys(d.categories)),
              ),
            ].filter((c) => !PURPOSES.some((p) => p.name === c)),
          ].map((name) => ({
            id: name,
            label: `${categoryGlyph(name)} ${name}`,
            color: categoryColor(name),
          })),
          { id: "unset", label: "No highlights yet", color: UNSET },
        ]
      : [
          ...[-2, -1, 0, 1, 2].map((n) => ({
            id: String(n),
            label: SENTIMENT_LABELS[n],
            color: SENTIMENT_COLORS[n],
          })),
          { id: "unset", label: "Not scored yet", color: UNSET },
        ]

  function matchesFocus(day: HeatmapDay) {
    if (focus === null) return true
    if (mode === "category")
      return focus === "unset" ? !day.category : day.category === focus
    if (day.sentiment === null) return focus === "unset"
    return String(sentimentStep(day.sentiment)) === focus
  }

  return (
    <section
      aria-labelledby="heatmap-title"
      className="rounded-2xl border border-white/[0.07] bg-panel p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="heatmap-title" className="font-serif text-xl text-ink">
            {title}
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            {entryCount} {entryCount === 1 ? "entry" : "entries"} across{" "}
            {yearDays.length} {yearDays.length === 1 ? "day" : "days"} in {year}
            . Each day shows{" "}
            {mode === "category"
              ? "its most frequent kind of highlight"
              : "its overall tone"}
            ; the more you wrote, the brighter it is.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Color days by"
            className="inline-flex rounded-full border border-white/10 p-0.5 text-xs"
          >
            {(["category", "sentiment"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m)
                  setFocus(null)
                }}
                className={`rounded-full px-3 py-1 ${mode === m ? "bg-white/10 text-ink" : "text-stone-400 hover:text-stone-200"}`}
              >
                {m === "category" ? "Category" : "Sentiment"}
              </button>
            ))}
          </div>
          {years.length > 1 && (
            <div className="flex gap-1">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs ${y === year ? "bg-white/10 text-ink" : "text-stone-500 hover:text-stone-200"}`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* legend doubles as a filter: pick one to light only those days */}
      <ul className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1">
        {legend.map((item) => {
          const active = focus === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setFocus(active ? null : item.id)}
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition ${
                  active
                    ? "bg-white/10 text-ink"
                    : "text-stone-400 hover:text-stone-200"
                } ${focus && !active ? "opacity-40" : ""}`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-sm"
                  style={
                    item.id === "unset"
                      ? UNSET_STYLE
                      : { background: item.color }
                  }
                />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>

      <div
        data-heatmap
        className="relative mt-4"
        onMouseLeave={() => setHover(null)}
      >
        {/* the grid, with (in the slideshow) an arrow each side */}
        <div className="flex items-center gap-4">
          {nav?.prev}
          <div className="min-w-0 overflow-x-auto pb-1">
            <div className="inline-flex gap-2">
              <div
                aria-hidden
                className="grid font-mono text-[10px] text-stone-500"
                style={{
                  gridTemplateRows: `14px repeat(7, ${CELL}px)`,
                  rowGap: GAP,
                }}
              >
                <span />
                {WEEKDAYS.map((d, i) => (
                  <span key={i} className="leading-[12px]">
                    {d}
                  </span>
                ))}
              </div>
              <div className="flex" style={{ gap: GAP }}>
                {weeks.map((week, w) => {
                  const firstOfMonth = week.find((d) => d?.getDate() === 1)
                  return (
                    <div
                      key={w}
                      className="grid"
                      style={{
                        gridTemplateColumns: `${CELL}px`,
                        gridTemplateRows: `14px repeat(7, ${CELL}px)`,
                        rowGap: GAP,
                      }}
                    >
                      <span
                        aria-hidden
                        className="whitespace-nowrap font-mono text-[10px] leading-[12px] text-stone-500"
                      >
                        {firstOfMonth?.toLocaleDateString("en-US", {
                          month: "short",
                        }) ?? ""}
                      </span>
                      {week.map((date, d) => {
                        if (!date) return <span key={d} />
                        const k = key(date)
                        const day = days[k]
                        const show = (el: HTMLElement) => {
                          const box = el.getBoundingClientRect()
                          const parent = el
                            .closest("[data-heatmap]")!
                            .getBoundingClientRect()
                          setHover({
                            key: k,
                            x: box.left - parent.left + CELL / 2,
                            y: box.top - parent.top,
                          })
                        }
                        const cell = (
                          <span
                            className="block h-full w-full rounded-[3px] transition-opacity"
                            style={{
                              ...(isUnset(day, mode)
                                ? UNSET_STYLE
                                : { background: dayColor(day, mode) }),
                              opacity: !day
                                ? 1
                                : matchesFocus(day)
                                  ? density(day.words, mostWords)
                                  : 0.12,
                            }}
                          />
                        )
                        const label = `${date.toDateString()}: ${
                          day
                            ? `${day.entries} ${day.entries === 1 ? "entry" : "entries"}, ${day.words.toLocaleString()} words, ${
                                mode === "category"
                                  ? (day.category ?? "no highlights yet")
                                  : day.sentiment === null
                                    ? "not scored yet"
                                    : SENTIMENT_LABELS[
                                        sentimentStep(day.sentiment)
                                      ]
                              }`
                            : "nothing written"
                        }`
                        return day ? (
                          <a
                            key={d}
                            href={`${BASE_PATH}/#d-${k}`}
                            aria-label={label}
                            onMouseEnter={(e) => show(e.currentTarget)}
                            onFocus={(e) => show(e.currentTarget)}
                            onBlur={() => setHover(null)}
                            className="block rounded-[3px] outline-offset-1 hover:ring-1 hover:ring-white/60"
                          >
                            {cell}
                          </a>
                        ) : (
                          <span
                            key={d}
                            aria-label={label}
                            onMouseEnter={(e) => show(e.currentTarget)}
                          >
                            {cell}
                          </span>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          {nav?.next}
        </div>

        {hover && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/15 bg-stone-900/95 px-3 py-2 text-xs shadow-xl"
            style={{ left: hover.x, top: hover.y - 6 }}
          >
            <p className="font-mono text-stone-300">
              {new Date(`${hover.key}T00:00`).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {hovered ? (
              <>
                <p className="mt-0.5 text-stone-400">
                  {hovered.entries}{" "}
                  {hovered.entries === 1 ? "entry" : "entries"} ·{" "}
                  {hovered.words.toLocaleString()}{" "}
                  {hovered.words === 1 ? "word" : "words"}
                  {hovered.sentiment !== null &&
                    ` · ${SENTIMENT_LABELS[sentimentStep(hovered.sentiment)].toLowerCase()} tone`}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(hovered.categories).map(([name, count]) => (
                    <li
                      key={name}
                      className="flex items-center gap-1.5 text-stone-200"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-sm"
                        style={{ background: categoryColor(name) }}
                      />
                      {name}
                      <span className="text-stone-500">
                        {count} {count === 1 ? "highlight" : "highlights"}
                      </span>
                      {name === hovered.category &&
                        Object.keys(hovered.categories).length > 1 && (
                          <span className="text-stone-500">(main)</span>
                        )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-0.5 text-stone-500">Nothing written</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
