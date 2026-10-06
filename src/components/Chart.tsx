"use client"

import { useEffect, useRef, useState } from "react"
import type { ChartData } from "@/features/insights/compute"

const HEIGHT = 240
const PAD = { top: 12, right: 12, bottom: 28, left: 40 }
const SURFACE = "#161617"

function formatValue(v: number, percent: boolean) {
  if (percent) return `${Math.round(v * 100)}%`
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v * 10) / 10}`
}

function niceMax(max: number) {
  if (max <= 0) return 1
  const step = 10 ** Math.floor(Math.log10(max))
  return Math.ceil(max / step) * step
}

// Stacked bars or lines from computed ChartData. Hover a column for values;
// "Table" shows the same numbers as text.
export function Chart({
  data,
  kind,
  percent = false,
}: {
  data: ChartData
  kind: "bar" | "line" | "area"
  percent?: boolean
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { labels, series } = data
  const empty =
    labels.length === 0 || series.every((s) => s.values.every((v) => v === 0))

  // bars and areas stack; lines overlap
  const stacked = kind !== "line"
  const columnTotals = labels.map((_, i) =>
    stacked
      ? series.reduce((sum, s) => sum + s.values[i], 0)
      : Math.max(...series.map((s) => s.values[i])),
  )
  const max = percent ? 1 : niceMax(Math.max(0, ...columnTotals))
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const band = labels.length ? plotW / labels.length : plotW
  const barW = Math.max(2, Math.min(36, band * 0.62))
  const x = (i: number) => PAD.left + band * i + band / 2
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  // thin out x labels so they never collide (~64px each)
  const every = Math.max(
    1,
    Math.ceil((labels.length * 64) / Math.max(plotW, 1)),
  )

  return (
    <div ref={wrap}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {series.length > 1 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {series.map((s) => (
              <li
                key={s.name}
                className="flex items-center gap-1.5 text-xs text-stone-400"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: s.color }}
                />
                {s.name}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          className="font-mono text-[11px] uppercase tracking-widest text-stone-500 hover:text-stone-200"
        >
          {table ? "Chart" : "Table"}
        </button>
      </div>

      {empty ? (
        <p className="py-16 text-center text-sm text-stone-500">
          No data for this view yet.
        </p>
      ) : table ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-stone-500">
              <tr>
                <th className="py-1 pr-4 font-normal" />
                {series.map((s) => (
                  <th key={s.name} className="py-1 pr-4 font-normal">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono text-stone-300">
              {labels.map((label, i) => (
                <tr key={label} className="border-t border-white/5">
                  <td className="py-1 pr-4 font-sans text-stone-400">
                    {label}
                  </td>
                  {series.map((s) => (
                    <td key={s.name} className="py-1 pr-4">
                      {formatValue(s.values[i], percent)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" onMouseLeave={() => setHover(null)}>
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Chart; use the Table button for the values"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="rgb(255 255 255 / 0.06)"
                />
                <text
                  x={PAD.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-stone-500 font-mono text-[10px]"
                >
                  {formatValue(t, percent)}
                </text>
              </g>
            ))}

            {labels.map((label, i) =>
              i % every === 0 ? (
                <text
                  key={label}
                  x={x(i)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-stone-500 font-mono text-[10px]"
                >
                  {label}
                </text>
              ) : null,
            )}

            {kind === "area" &&
              (() => {
                // cumulative tops per series, then one polygon per layer
                const tops: number[][] = []
                series.forEach((s, k) =>
                  tops.push(
                    s.values.map((v, i) => v + (k ? tops[k - 1][i] : 0)),
                  ),
                )
                return series.map((s, k) => {
                  const upper = labels.map((_, i) => `${x(i)},${y(tops[k][i])}`)
                  const lower = labels
                    .map((_, i) => `${x(i)},${y(k ? tops[k - 1][i] : 0)}`)
                    .reverse()
                  return (
                    <polygon
                      key={s.name}
                      points={[...upper, ...lower].join(" ")}
                      fill={s.color}
                      fillOpacity={0.85}
                      // a thin surface seam keeps neighbouring layers apart
                      stroke={SURFACE}
                      strokeWidth={series.length > 1 ? 1.5 : 0}
                      strokeLinejoin="round"
                    />
                  )
                })
              })()}

            {kind === "area"
              ? null
              : stacked
                ? labels.map((_, i) => {
                    let base = 0
                    return (
                      <g
                        key={i}
                        opacity={hover === null || hover === i ? 1 : 0.55}
                      >
                        {series.map((s) => {
                          const v = s.values[i]
                          if (v <= 0) return null
                          const top = y(base + v)
                          const h = y(base) - top
                          base += v
                          // 2px surface stroke separates stacked segments
                          return (
                            <rect
                              key={s.name}
                              x={x(i) - barW / 2}
                              y={top}
                              width={barW}
                              height={Math.max(h, 1)}
                              rx={2}
                              fill={s.color}
                              stroke={SURFACE}
                              strokeWidth={series.length > 1 ? 2 : 0}
                            />
                          )
                        })}
                      </g>
                    )
                  })
                : series.map((s) => (
                    <g key={s.name}>
                      <polyline
                        fill="none"
                        stroke={s.color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        points={s.values
                          .map((v, i) => `${x(i)},${y(v)}`)
                          .join(" ")}
                      />
                      {labels.length <= 40 &&
                        s.values.map((v, i) => (
                          <circle
                            key={i}
                            cx={x(i)}
                            cy={y(v)}
                            r={hover === i ? 5 : 3.5}
                            fill={s.color}
                            stroke={SURFACE}
                            strokeWidth={2}
                          />
                        ))}
                    </g>
                  ))}

            {hover !== null && kind !== "bar" && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="rgb(255 255 255 / 0.25)"
              />
            )}

            {/* hit targets: one full-height column per label */}
            {labels.map((_, i) => (
              <rect
                key={i}
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            ))}
          </svg>

          {hover !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-white/15 bg-stone-900/95 px-3 py-2 text-xs shadow-xl"
              style={{
                left: Math.min(Math.max(x(hover), 80), width - 80),
                top: 0,
                transform: "translateX(-50%)",
              }}
            >
              <p className="mb-1 font-mono text-stone-300">{labels[hover]}</p>
              <ul className="space-y-0.5">
                {series
                  .filter((s) => s.values[hover] > 0 || series.length === 1)
                  .map((s) => (
                    <li
                      key={s.name}
                      className="flex items-center justify-between gap-4 text-stone-200"
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-sm"
                          style={{ background: s.color }}
                        />
                        {s.name}
                      </span>
                      <span className="font-mono">
                        {formatValue(s.values[hover], percent)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!empty && data.summary && (
        <p className="mt-3 text-sm text-stone-300">{data.summary}</p>
      )}
      {data.notes.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs text-stone-500">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
