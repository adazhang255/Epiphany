"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  cleanLegend,
  colorHue,
  hueColor,
  PALETTE,
  type LegendItem,
} from "@/features/trackers/legend"
import type { TrackerView } from "@/features/trackers/trackers"
import { DayHeatmap, type HeatmapDay } from "@/components/DayHeatmap"

// Trackers on the Stats overview: day-by-day questions you answer yourself
// ("How am I feeling?"), apart from your entries. Each is a grid of days like the tone
// grid on Stats; click a day to give its answer. Ask and the writer profile
// read them alongside your entries.

const CELL = 13
const GAP = 3
const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""]
// the colour slider's track: every hue it can give
const HUES = Array.from({ length: 13 }, (_, i) => hueColor(i * 30)).join(", ")

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const niceDay = (k: string) =>
  new Date(`${k}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })

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

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null)
  const data = await res?.json().catch(() => null)
  return { ok: Boolean(res?.ok), data }
}

// ---- making or changing a tracker ------------------------------------------

function TrackerForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: TrackerView
  onDone: (tracker: { id: string; name: string; legend: LegendItem[] }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [legend, setLegend] = useState<LegendItem[]>(initial?.legend ?? [])
  const [suggesting, setSuggesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function suggest() {
    if (!name.trim()) return setError("Write the question first.")
    setSuggesting(true)
    setError("")
    const { ok, data } = await send("/api/trackers/suggest", "POST", {
      question: name,
    })
    setSuggesting(false)
    if (!ok || !data?.legend?.length)
      return setError(
        data?.error ?? "Couldn't suggest answers. Is Ollama running?",
      )
    setLegend(data.legend)
  }

  const change = (i: number, patch: Partial<LegendItem>) =>
    setLegend((l) =>
      l.map((item, j) => (j === i ? { ...item, ...patch } : item)),
    )
  const move = (i: number, by: number) =>
    setLegend((l) => {
      const next = [...l]
      const [item] = next.splice(i, 1)
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item)
      return next
    })

  async function save() {
    const clean = cleanLegend(legend)
    if (!name.trim()) return setError("Write the question first.")
    if (clean.length < 2) return setError("Give it at least two answers.")
    setSaving(true)
    setError("")
    const { ok, data } = initial
      ? await send(`/api/trackers/${initial.id}`, "PATCH", {
          name,
          legend: clean,
        })
      : await send("/api/trackers", "POST", { name, legend: clean })
    setSaving(false)
    if (!ok) return setError(data?.error ?? "Couldn't save it.")
    onDone({ id: initial?.id ?? data.id, name: name.trim(), legend: clean })
  }

  const removed = initial
    ? initial.legend.filter((l) => !legend.some((x) => x.key === l.key))
    : []

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-panel p-5">
      <label htmlFor="tracker-question" className="font-serif text-xl text-ink">
        {initial ? "Change this tracker" : "A new tracker"}
      </label>
      <p className="mt-1 text-sm text-stone-400">
        Something to answer each day, apart from your entries. Your local AI
        suggests the answers; change them as you like.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          id="tracker-question"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !legend.length && suggest()}
          placeholder="e.g. How am I feeling?"
          maxLength={120}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-stone-100 outline-none focus:border-white/30"
        />
        <button
          type="button"
          onClick={suggest}
          disabled={suggesting}
          className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-stone-200 transition hover:bg-white/5 disabled:opacity-50"
        >
          {suggesting
            ? "Thinking…"
            : legend.length
              ? "Suggest again"
              : "Suggest answers"}
        </button>
      </div>

      {legend.length > 0 && (
        <ol className="mt-4 space-y-1.5">
          {legend.map((item, i) => (
            <li key={item.key} className="flex items-center gap-2">
              <span className="w-5 text-right font-mono text-[11px] text-stone-600">
                {i + 1}
              </span>
              {/* the colour: a hue slider beside a swatch of it */}
              <span
                aria-hidden
                className="h-6 w-6 shrink-0 rounded-md border border-white/20"
                style={{ background: item.color }}
              />
              <input
                type="range"
                min={0}
                max={359}
                value={colorHue(item.color)}
                onChange={(e) =>
                  change(i, { color: hueColor(Number(e.target.value)) })
                }
                aria-label={`Colour for ${item.label || `answer ${i + 1}`}`}
                className="tracker-hue w-24 shrink-0 sm:w-32"
                style={{ background: `linear-gradient(to right, ${HUES})` }}
              />
              <input
                value={item.label}
                onChange={(e) => change(i, { label: e.target.value })}
                aria-label={`Answer ${i + 1}`}
                maxLength={40}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-stone-100 outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
                className="px-1 text-stone-500 hover:text-stone-200 disabled:opacity-20"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === legend.length - 1}
                aria-label="Move down"
                className="px-1 text-stone-500 hover:text-stone-200 disabled:opacity-20"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setLegend((l) => l.filter((_, j) => j !== i))}
                aria-label={`Remove ${item.label}`}
                className="px-1 text-stone-500 hover:text-rose-300"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
      {legend.length < 9 && (
        <button
          type="button"
          onClick={() =>
            setLegend((l) => [
              ...l,
              {
                key: `answer-${Date.now().toString(36)}`,
                label: "",
                color: PALETTE[l.length % PALETTE.length],
              },
            ])
          }
          className="mt-2 text-xs text-stone-400 underline hover:text-stone-200"
        >
          + Add an answer yourself
        </button>
      )}

      {removed.length > 0 && (
        <p className="mt-3 text-xs text-amber-200/80">
          Days marked {removed.map((r) => `“${r.label}”`).join(", ")} will be
          cleared when you save.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-stone-900 transition hover:bg-white disabled:opacity-50"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Create tracker"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-stone-400 hover:text-stone-200"
        >
          Cancel
        </button>
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>
    </div>
  )
}

// ---- one tracker: today's answer and the year grid -------------------------

export function TrackerCard({
  tracker,
  today,
  onChange,
  onAddAnswer,
  onEdit,
  onDelete,
  nav,
}: {
  tracker: TrackerView
  today: string // YYYY-MM-DD
  onChange: (marks: Record<string, string>) => void
  // add an answer to its legend
  onAddAnswer?: (label: string) => Promise<boolean>
  onEdit?: () => void
  onDelete?: () => void
  // the slideshow's arrows: one each side of the grid
  nav?: { prev: React.ReactNode; next: React.ReactNode }
}) {
  const marks = tracker.marks
  const legendOf = new Map(tracker.legend.map((l) => [l.key, l]))
  const thisYear = Number(today.slice(0, 4))
  const years = useMemo(() => {
    const first = Math.min(
      thisYear,
      ...Object.keys(marks).map((d) => Number(d.slice(0, 4))),
    )
    return Array.from({ length: thisYear - first + 1 }, (_, i) => thisYear - i)
  }, [marks, thisYear])
  const [year, setYear] = useState(thisYear)
  const weeks = useMemo(() => buildYear(year), [year])
  const [open, setOpen] = useState<string | null>(null) // the day being marked
  // an answer picked in the legend: only its days stay lit
  const [focus, setFocus] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState("")
  // a new answer being typed in, under the legend
  const [adding, setAdding] = useState<string | null>(null)

  async function addAnswer() {
    const label = adding?.trim()
    if (!label || !onAddAnswer) return setAdding(null)
    if (await onAddAnswer(label)) setAdding(null)
    else setError("Couldn't add that answer.")
  }

  async function mark(day: string, value: string | null) {
    const before = marks
    const next = { ...marks }
    if (value) next[day] = value
    else delete next[day]
    onChange(next)
    setOpen(null)
    const { ok } = await send(`/api/trackers/${tracker.id}/marks`, "PUT", {
      day,
      value,
    })
    if (!ok) {
      onChange(before)
      setError("Couldn't save that day. Try again.")
    } else setError("")
  }

  const inYear = Object.entries(marks).filter(([d]) => d.startsWith(`${year}-`))
  const counts = new Map<string, number>()
  for (const [, v] of inYear) counts.set(v, (counts.get(v) ?? 0) + 1)

  const picker = (day: string) => (
    <div className="flex flex-wrap items-center gap-1">
      {tracker.legend.map((l) => {
        const on = marks[day] === l.key
        return (
          <button
            key={l.key}
            type="button"
            aria-pressed={on}
            onClick={() => mark(day, on ? null : l.key)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
              on
                ? "border-white/40 bg-white/10 text-ink"
                : "border-white/10 text-stone-300 hover:bg-white/5"
            }`}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: l.color }}
            />
            {l.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-xl text-ink">{tracker.name}</h3>
          <p className="mt-1 text-sm text-stone-400">
            {inYear.length} {inYear.length === 1 ? "day" : "days"} answered in{" "}
            {year}. Click a day to answer it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {years.length > 1 &&
            years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`rounded-md px-2 py-1 font-mono ${y === year ? "bg-white/10 text-ink" : "text-stone-500 hover:text-stone-200"}`}
              >
                {y}
              </button>
            ))}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="text-stone-400 underline hover:text-stone-200"
            >
              Edit
            </button>
          )}
          {!onDelete ? null : asking ? (
            <span className="flex items-center gap-2">
              <span className="text-rose-200">
                Delete it and its {Object.keys(marks).length} days?
              </span>
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-rose-400 px-2 py-0.5 font-bold text-stone-950"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="text-stone-400"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="text-stone-500 underline hover:text-rose-300"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* the answers, as the writing grid shows its categories: pick one to
          light only its days */}
      <ul className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1">
        {tracker.legend.map((l) => {
          const active = focus === l.key
          return (
            <li key={l.key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setFocus(active ? null : l.key)}
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition ${
                  active
                    ? "bg-white/10 text-ink"
                    : "text-stone-400 hover:text-stone-200"
                } ${focus && !active ? "opacity-40" : ""}`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: l.color }}
                />
                {l.label}
                <span className="font-mono text-stone-600">
                  {counts.get(l.key) ?? 0}
                </span>
              </button>
            </li>
          )
        })}
        <li>
          {onAddAnswer &&
            (adding === null ? (
              <button
                type="button"
                onClick={() => setAdding("")}
                className="px-2 text-xs text-stone-400 underline hover:text-stone-200"
              >
                + Add answer
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 px-1">
                <input
                  value={adding}
                  onChange={(e) => setAdding(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addAnswer()
                    if (e.key === "Escape") setAdding(null)
                  }}
                  autoFocus
                  maxLength={40}
                  placeholder="A new answer"
                  aria-label="New answer"
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-sm text-stone-100 outline-none focus:border-white/30"
                />
                <button
                  type="button"
                  onClick={addAnswer}
                  disabled={!adding.trim()}
                  className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-stone-900 disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(null)}
                  className="text-xs text-stone-500 hover:text-stone-300"
                >
                  Cancel
                </button>
              </div>
            ))}
        </li>
      </ul>

      {/* the grid, with (in the slideshow) an arrow each side */}
      <div className="mt-4 flex items-center gap-4">
        {nav?.prev}
        <div className="relative min-w-0 overflow-x-auto pb-1">
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
                <span key={i} className="leading-[13px]">
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
                      const k = dayKey(date)
                      const answer = legendOf.get(marks[k] ?? "")
                      const future = k > today
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={future}
                          onClick={() => setOpen(open === k ? null : k)}
                          aria-label={`${niceDay(k)}: ${answer?.label ?? "not answered"}`}
                          title={`${niceDay(k)}${answer ? ` · ${answer.label}` : ""}`}
                          className={`block rounded-[3px] transition ${
                            open === k
                              ? "ring-2 ring-white"
                              : future
                                ? ""
                                : "hover:ring-1 hover:ring-white/60"
                          } ${k === today ? "outline outline-1 outline-offset-1 outline-ember/70" : ""}`}
                          style={{
                            background: answer
                              ? answer.color
                              : future
                                ? "rgb(255 255 255 / 0.015)"
                                : "rgb(255 255 255 / 0.06)",
                            opacity:
                              focus && answer && answer.key !== focus
                                ? 0.15
                                : 1,
                          }}
                        />
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

      {/* answering: today, or the day you clicked above */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
        <span
          className={`font-mono text-[11px] uppercase tracking-widest ${
            open && open !== today ? "text-stone-300" : "text-ember"
          }`}
        >
          {open && open !== today ? niceDay(open) : "Today"}
        </span>
        {picker(open ?? today)}
        {open && open !== today ? (
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="ml-auto text-xs text-stone-500 hover:text-stone-300"
          >
            Back to today
          </button>
        ) : (
          <span className="ml-auto text-xs text-stone-600">
            Click a day above to answer it
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
    </section>
  )
}

// ---- shared on the page: the trackers, kept in one place ------------------
// The Trackers section and the "Day by day" slides show the same trackers;
// marking a day in one shows in the other at once.

type TrackersState = {
  trackers: TrackerView[] | null // null: the tables aren't set up yet
  today: string
  set: (update: (all: TrackerView[]) => TrackerView[]) => void
}
const TrackersContext = createContext<TrackersState | null>(null)

export function TrackersProvider({
  initial,
  today,
  children,
}: {
  initial: TrackerView[] | null
  today: string // YYYY-MM-DD
  children: React.ReactNode
}) {
  const [trackers, setTrackers] = useState(initial)
  const value = useMemo<TrackersState>(
    () => ({
      trackers,
      today,
      set: (update) => setTrackers((all) => (all ? update(all) : all)),
    }),
    [trackers, today],
  )
  return (
    <TrackersContext.Provider value={value}>
      {children}
    </TrackersContext.Provider>
  )
}

function useTrackers() {
  const state = useContext(TrackersContext)
  if (!state) throw new Error("useTrackers needs a TrackersProvider")
  return state
}

// what a card can do to its tracker
function useTrackerActions() {
  const { set } = useTrackers()
  return {
    setMarks: (id: string, marks: Record<string, string>) =>
      set((all) => all.map((x) => (x.id === id ? { ...x, marks } : x))),
    addAnswer: async (t: TrackerView, label: string) => {
      const used = new Set(t.legend.map((l) => l.color))
      const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[0]
      const legend = cleanLegend([...t.legend, { label, color }])
      if (legend.length === t.legend.length) return false // a repeat
      const { ok } = await send(`/api/trackers/${t.id}`, "PATCH", { legend })
      if (ok)
        set((all) => all.map((x) => (x.id === t.id ? { ...x, legend } : x)))
      return ok
    },
  }
}

// The slideshow's arrows, big, one each side of a slide's grid (where you
// are under the right one).
function slideArrows({
  index,
  count,
  name,
  go,
}: {
  index: number
  count: number
  name: (i: number) => string
  go: (by: number) => void
}) {
  if (count < 2) return undefined
  const arrow =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-2xl leading-none text-stone-200 transition hover:border-white/30 hover:bg-white/10"
  return {
    prev: (
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label={`Previous: ${name((index - 1 + count) % count)}`}
        className={arrow}
      >
        ‹
      </button>
    ),
    next: (
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(1)}
          aria-label={`Next: ${name((index + 1) % count)}`}
          className={arrow}
        >
          ›
        </button>
        <span className="font-mono text-[11px] text-stone-500">
          {index + 1} / {count}
        </span>
      </div>
    ),
  }
}

// which slide this browser last showed (your writing, or a tracker's id)
const SLIDE_KEY = "daybyday:slide"
const WRITING = "writing"

// ---- the "Day by day" section (Stats overview) -----------------------------
// One slideshow: your writing first, then each of your trackers; ‹ › moves
// between them, and this browser keeps showing the one you chose until you
// pick another. Each tracker's slide is where you answer it, add answers,
// change or delete it.

export function Trackers({
  days,
}: {
  // your writing, day by day: the first slide
  days: Record<string, HeatmapDay>
}) {
  const { trackers, today, set } = useTrackers()
  const actions = useTrackerActions()
  const [form, setForm] = useState<"new" | string | null>(null)
  const [current, setCurrent] = useState(WRITING)

  // the slide chosen last time in this browser
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SLIDE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage, which the server can't
      if (saved) setCurrent(saved)
    } catch {}
  }, [])
  const choose = (id: string) => {
    setCurrent(id)
    try {
      window.localStorage.setItem(SLIDE_KEY, id)
    } catch {}
  }

  const list = trackers ?? []
  const slides = [WRITING, ...list.map((t) => t.id)]
  const count = slides.length
  // (a tracker that's gone, or not loaded: back to your writing)
  const index = Math.max(0, slides.indexOf(current))
  const tracker = index === 0 ? null : list[index - 1]
  const name = (i: number) => (i === 0 ? "Your writing" : list[i - 1].name)
  const go = (by: number) => {
    setForm(null)
    choose(slides[(((index + by) % count) + count) % count])
  }
  const arrows = slideArrows({ index, count, name, go })

  return (
    <section aria-labelledby="trackers-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="trackers-title" className="font-serif text-2xl text-ink">
            Day by day
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-400">
            Your writing, and anything you track yourself (how you feel, how you
            slept, what you did): ‹ › flips between them. Ask and your writer
            profile read your trackers alongside what you wrote.
          </p>
        </div>
        {trackers !== null && form !== "new" && (
          <button
            type="button"
            onClick={() => setForm("new")}
            className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-stone-200 transition hover:bg-white/5"
          >
            + New tracker
          </button>
        )}
      </div>

      {form === "new" && (
        <TrackerForm
          onCancel={() => setForm(null)}
          onDone={(t) => {
            set((all) => [...all, { ...t, marks: {} }])
            setForm(null)
            choose(t.id)
          }}
        />
      )}

      {count > 1 && (
        <div
          role="group"
          aria-label="Day by day slides"
          className="flex items-center gap-2"
        >
          <p className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.2em] text-ember/90">
            {name(index)}
          </p>
          <div className="ml-auto flex items-center gap-1.5 pr-1">
            {slides.map((id, i) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setForm(null)
                  choose(id)
                }}
                aria-label={name(i)}
                aria-current={i === index ? "true" : undefined}
                title={name(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index
                    ? "w-5 bg-ember"
                    : "w-2 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {!tracker ? (
        <DayHeatmap days={days} title="Your writing" nav={arrows} />
      ) : form === tracker.id ? (
        <TrackerForm
          key={tracker.id}
          initial={tracker}
          onCancel={() => setForm(null)}
          onDone={(changed) => {
            const keys = new Set(changed.legend.map((l) => l.key))
            set((all) =>
              all.map((x) =>
                x.id === tracker.id
                  ? {
                      ...x,
                      ...changed,
                      marks: Object.fromEntries(
                        Object.entries(x.marks).filter(([, v]) => keys.has(v)),
                      ),
                    }
                  : x,
              ),
            )
            setForm(null)
          }}
        />
      ) : (
        <TrackerCard
          key={tracker.id}
          tracker={tracker}
          today={today}
          onChange={(marks) => actions.setMarks(tracker.id, marks)}
          onAddAnswer={(label) => actions.addAnswer(tracker, label)}
          onEdit={() => setForm(tracker.id)}
          nav={arrows}
          onDelete={async () => {
            const { ok } = await send(`/api/trackers/${tracker.id}`, "DELETE")
            if (!ok) return
            set((all) => all.filter((x) => x.id !== tracker.id))
            choose(slides[index - 1] ?? WRITING)
          }}
        />
      )}

      {trackers === null ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-stone-400">
          Track anything else day by day too (“How am I feeling?”), apart from
          your entries. To turn trackers on, run{" "}
          <code className="rounded bg-white/10 px-1">npm run db:push</code> once
          (it adds two tables to your journal&apos;s database; nothing else
          changes), then reload.
        </p>
      ) : (
        list.length === 0 &&
        form === null && (
          <p className="text-sm text-stone-500">
            Track something of your own day by day with “+ New tracker” (e.g.
            “How am I feeling?”): it becomes the next slide.
          </p>
        )
      )}
    </section>
  )
}
