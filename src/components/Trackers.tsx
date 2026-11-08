"use client"

import Link from "next/link"
import { showUndo } from "@/components/UndoToast"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  cleanLegend,
  cleanScale,
  DEFAULT_SCALE,
  formatScale,
  scaleColor,
  scaleValue,
  type Scale,
  colorHue,
  GREY,
  GREY_FROM,
  hueColor,
  SLIDER_MAX,
  PALETTE,
  type LegendItem,
} from "@/features/trackers/legend"
import type { TrackerView } from "@/features/trackers/trackers"
import { DayHeatmap, type HeatmapDay } from "@/components/DayHeatmap"

// Trackers, on their own Stats tab: day-by-day questions you answer yourself
// ("How am I feeling?"), apart from your entries. Each is a grid of days like the tone
// grid on Stats; click a day to give its answer. Ask and the writer profile
// read them alongside your entries.

const CELL = 13
const GAP = 3
const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""]
// the colour slider's track: every hue it can give
// the slider's track: the hues, then the grey band at the end
const at = (v: number) => `${((v / SLIDER_MAX) * 100).toFixed(2)}%`
const HUES = [
  ...Array.from({ length: 13 }, (_, i) => `${hueColor(i * 30)} ${at(i * 30)}`),
  `${GREY} ${at(GREY_FROM)}`,
  `${GREY} 100%`,
].join(", ")

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
  onDone: (tracker: {
    id: string
    name: string
    legend: LegendItem[]
    scale: Scale | null
  }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [legend, setLegend] = useState<LegendItem[]>(initial?.legend ?? [])
  // a scale instead of answers (chosen when it's made)
  const [scale, setScale] = useState<Scale | null>(initial?.scale ?? null)
  // the scale's numbers as typed (a half-typed "-" or "0." stays put)
  const [typed, setTyped] = useState(() => {
    const s = initial?.scale ?? DEFAULT_SCALE
    // (no step: any number, left blank)
    return {
      min: String(s.min),
      max: String(s.max),
      step: s.step ? String(s.step) : "",
    }
  })
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

  // the scale as it stands, with the numbers typed so far
  const scaleNow =
    scale &&
    cleanScale({
      ...scale,
      min: typed.min,
      max: typed.max,
      step: typed.step.trim() || 0,
    })
  const changeScale = (patch: Partial<Scale>) =>
    setScale((s) => (s ? { ...s, ...patch } : s))

  async function save() {
    if (!name.trim()) return setError("Write the question first.")
    if (scale && !scaleNow)
      return setError("Make the lowest number smaller than the highest.")
    const clean = cleanLegend(legend)
    if (!scale && clean.length < 2)
      return setError("Give it at least two answers.")
    const kind = scaleNow ? { scale: scaleNow } : { legend: clean }
    setSaving(true)
    setError("")
    const { ok, data } = initial
      ? await send(`/api/trackers/${initial.id}`, "PATCH", { name, ...kind })
      : await send("/api/trackers", "POST", { name, ...kind })
    setSaving(false)
    if (!ok) return setError(data?.error ?? "Couldn't save it.")
    onDone({
      id: initial?.id ?? data.id,
      name: name.trim(),
      legend: scaleNow ? [] : clean,
      scale: scaleNow,
    })
  }

  const removed =
    initial && !scale
      ? initial.legend.filter((l) => !legend.some((x) => x.key === l.key))
      : []
  // days answered past a scale's new ends
  const outside =
    initial?.scale && scaleNow
      ? Object.values(initial.marks).filter(
          (v) => scaleValue(scaleNow, v) === null,
        ).length
      : 0
  const hueSlider = (
    color: string,
    label: string,
    set: (c: string) => void,
  ) => (
    <input
      type="range"
      min={0}
      max={SLIDER_MAX}
      value={colorHue(color)}
      onChange={(e) => set(hueColor(Number(e.target.value)))}
      aria-label={label}
      className="tracker-hue w-24 shrink-0 sm:w-32"
      style={{ background: `linear-gradient(to right, ${HUES})` }}
    />
  )
  const numberBox =
    "w-20 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-stone-100 outline-none focus:border-white/30"

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-panel p-5">
      <label htmlFor="tracker-question" className="font-serif text-xl text-ink">
        {initial ? "Change this tracker" : "A new tracker"}
      </label>
      <p className="mt-1 text-sm text-stone-400">
        Something to answer each day, apart from your entries.{" "}
        {scale
          ? "Answer it with any number between two ends (hours slept, 1–10…)."
          : "Your local AI suggests the answers; change them as you like."}
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
        {!scale && (
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
        )}
      </div>

      {/* answered by picking one of set answers, or with a number on a
          scale (chosen when it's made) */}
      {!initial && (
        <div
          role="radiogroup"
          aria-label="How it's answered"
          className="mt-3 inline-flex rounded-full border border-white/10 p-1 text-sm"
        >
          {(
            [
              ["answers", "Answers"],
              ["scale", "Number scale"],
            ] as const
          ).map(([kind, label]) => {
            const on = (kind === "scale") === Boolean(scale)
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() =>
                  setScale(kind === "scale" ? (scale ?? DEFAULT_SCALE) : null)
                }
                className={`rounded-full px-3 py-1 transition ${on ? "bg-white/10 text-ink" : "text-stone-400 hover:text-stone-200"}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {scale && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3 text-sm text-stone-400">
            {(
              [
                ["min", "From"],
                ["max", "To"],
                ["step", "In steps of"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="flex flex-col gap-1">
                {label}
                <input
                  inputMode="decimal"
                  value={typed[field]}
                  onChange={(e) =>
                    setTyped((t) => ({ ...t, [field]: e.target.value }))
                  }
                  placeholder={field === "step" ? "any" : undefined}
                  title={
                    field === "step"
                      ? "Blank for any number (like 1.3); or e.g. 1 for whole numbers"
                      : undefined
                  }
                  className={numberBox}
                />
              </label>
            ))}
            <label className="flex flex-col gap-1">
              Unit <span className="sr-only">(optional)</span>
              <input
                value={scale.unit}
                onChange={(e) => changeScale({ unit: e.target.value })}
                placeholder="e.g. hours"
                maxLength={20}
                className={`${numberBox} w-28`}
              />
            </label>
          </div>
          {(["low", "high"] as const).map((which) => {
            const e = scale[which]
            return (
              <div key={which} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-right font-mono text-[11px] text-stone-500">
                  {which === "low" ? typed.min || "low" : typed.max || "high"}
                </span>
                <span
                  aria-hidden
                  className="h-6 w-6 shrink-0 rounded-md border border-white/20"
                  style={{ background: e.color }}
                />
                {hueSlider(e.color, `Colour for the ${which} end`, (color) =>
                  changeScale({ [which]: { ...e, color } }),
                )}
                <input
                  value={e.label}
                  onChange={(ev) =>
                    changeScale({ [which]: { ...e, label: ev.target.value } })
                  }
                  placeholder={which === "low" ? "e.g. Awful" : "e.g. Great"}
                  aria-label={`What the ${which} end means`}
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-stone-100 outline-none focus:border-white/30"
                />
              </div>
            )
          })}
          <div
            aria-hidden
            className="ml-14 h-2.5 rounded-full"
            style={{
              background: `linear-gradient(to right, ${scale.low.color}, ${scale.high.color})`,
            }}
          />
          {outside > 0 && (
            <p className="text-xs text-amber-200/80">
              {outside} {outside === 1 ? "day is" : "days are"} answered outside{" "}
              {formatScale(scaleNow!, scaleNow!.min)}–
              {formatScale(scaleNow!, scaleNow!.max)} and will be cleared when
              you save.
            </p>
          )}
        </div>
      )}

      {!scale && legend.length > 0 && (
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
                max={SLIDER_MAX}
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
      {!scale && legend.length < 9 && (
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

// A scale's answer for a day: a slider between its ends, and the number
// itself to type. Saved a moment after you stop moving it (or at once, on
// Enter). `typing`: the number box starts focused, with this typed in (a
// day just picked in the grid, or a key pressed on it).
function ScaleAnswer({
  scale,
  value,
  onSet,
  typing,
}: {
  scale: Scale
  value: number | null // the day's answer, if it has one
  onSet: (value: number | null) => void
  typing?: string
}) {
  const middle = scaleValue(scale, (scale.min + scale.max) / 2) ?? scale.min
  // where the slider is (null: untouched, on a day with no answer)
  const [draft, setDraft] = useState<number | null>(value)
  const [typed, setTyped] = useState<string | null>(typing ? typing : null)
  const [bad, setBad] = useState(false)
  const numberBox = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = numberBox.current
    if (typing === undefined || !el) return
    el.focus()
    // a day picked: what's there is selected, to type over
    if (typing) el.setSelectionRange(el.value.length, el.value.length)
    else el.select()
  }, [typing])
  useEffect(() => {
    if (draft === null || draft === value) return
    const t = setTimeout(() => onSet(draft), 450)
    return () => clearTimeout(t)
  }, [draft, value, onSet])

  const shown = draft ?? middle
  function typedIn() {
    if (typed === null) return null
    const n = typed.trim() === "" ? null : scaleValue(scale, typed)
    setBad(typed.trim() !== "" && n === null)
    if (n !== null) setDraft(n)
    setTyped(null)
    return n
  }
  return (
    <div className="space-y-2.5">
      {/* the slider across, what its ends mean under them */}
      <div>
        <input
          type="range"
          min={scale.min}
          max={scale.max}
          step={scale.step || "any"}
          value={shown}
          onChange={(e) => {
            setBad(false)
            setDraft(scaleValue(scale, e.target.value))
          }}
          aria-label="Your answer"
          aria-valuetext={
            draft === null ? "not answered" : formatScale(scale, shown)
          }
          className={`block h-2 w-full cursor-pointer pointer-coarse:h-3 ${draft === null ? "opacity-40" : ""}`}
          style={{ accentColor: scaleColor(scale, shown) }}
        />
        <div className="mt-1 flex justify-between gap-4 text-xs text-stone-400">
          <span>{scale.low.label || formatScale(scale, scale.min)}</span>
          <span className="text-right">
            {scale.high.label || formatScale(scale, scale.max)}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          inputMode="decimal"
          value={typed ?? (draft === null ? "" : String(draft))}
          placeholder="–"
          onChange={(e) => setTyped(e.target.value)}
          ref={numberBox}
          onBlur={typedIn}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            // saved now, not in a moment
            const n = typedIn()
            if (n !== null && n !== value) onSet(n)
          }}
          aria-label={`Your answer, from ${scale.min} to ${scale.max}`}
          className="w-20 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-stone-100 outline-none focus:border-white/30"
        />
        {scale.unit && <span className="text-stone-400">{scale.unit}</span>}
        {draft === null ? (
          <span className="text-xs text-stone-500">
            Move the slider or type a number
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(null)
              onSet(null)
            }}
            className="text-xs text-stone-500 underline hover:text-stone-300"
          >
            Clear
          </button>
        )}
        {bad && (
          <span className="text-xs text-rose-300">
            A number from {formatScale(scale, scale.min)} to{" "}
            {formatScale(scale, scale.max)}
          </span>
        )}
      </div>
    </div>
  )
}

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
  const scale = tracker.scale
  const legendOf = new Map(tracker.legend.map((l) => [l.key, l]))
  // a day's answer: its number on a scale, or which of the answers
  const numberOf = (v: string | undefined) =>
    scale && v !== undefined ? scaleValue(scale, v) : null
  const answerOf = (v: string | undefined) => {
    if (!scale) {
      const l = legendOf.get(v ?? "")
      return l ? { key: l.key, label: l.label, color: l.color } : null
    }
    const n = numberOf(v)
    return n === null
      ? null
      : { key: null, label: formatScale(scale, n), color: scaleColor(scale, n) }
  }
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
  // a scale's number box, focused with this typed in (a day picked in the
  // grid, or a number key pressed); `times` starts it afresh each time
  const [typing, setTyping] = useState<{ text: string; times: number }>()
  const typeIn = (text: string) =>
    setTyping((t) => ({ text, times: (t?.times ?? 0) + 1 }))

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
    setTyping(undefined)
    // (a scale's slider stays on its day while you move it)
    if (!scale) setOpen(null)
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
  const numbers = inYear
    .map(([, v]) => numberOf(v))
    .filter((n): n is number => n !== null)
  const average = numbers.length
    ? numbers.reduce((a, b) => a + b, 0) / numbers.length
    : null

  const picker = (day: string) => (
    <div
      role="group"
      aria-label={`Answer for ${niceDay(day)}`}
      className="flex flex-wrap items-center gap-2"
    >
      {tracker.legend.map((l, i) => {
        const on = marks[day] === l.key
        return (
          <button
            key={l.key}
            type="button"
            aria-pressed={on}
            onClick={() => mark(day, on ? null : l.key)}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition pointer-coarse:py-2.5 ${
              on
                ? "bg-white/10 font-medium text-ink"
                : "border-white/15 text-stone-300 hover:border-white/30 hover:bg-white/5"
            }`}
            style={on ? { borderColor: l.color } : undefined}
          >
            <span
              aria-hidden
              className="h-3 w-3 rounded-sm"
              style={{ background: l.color }}
            />
            {l.label}
            {on ? (
              <span aria-hidden className="text-ember">
                ✓
              </span>
            ) : (
              // its key, to answer by typing
              i < 9 && (
                <kbd className="font-mono text-[10px] text-stone-600 pointer-coarse:hidden">
                  {i + 1}
                </kbd>
              )
            )}
          </button>
        )
      })}
      {onAddAnswer &&
        (adding === null ? (
          <button
            type="button"
            onClick={() => setAdding("")}
            className="rounded-full border border-dashed border-white/15 px-3.5 py-1.5 text-sm text-stone-400 transition hover:border-white/30 hover:text-stone-200 pointer-coarse:py-2.5"
          >
            + New answer
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
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
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-stone-100 outline-none focus:border-white/30"
            />
            <button
              type="button"
              onClick={addAnswer}
              disabled={!adding.trim()}
              className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-stone-900 disabled:opacity-40"
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
          </span>
        ))}
    </div>
  )

  // which day the answers are for: today, or one tapped in the grid
  const day = open ?? today
  const other = day !== today

  // typing a number answers the day picked (today, or one in the grid): a
  // scale's number box takes it; set answers go by their place (1 the first)
  function onKeyDown(e: React.KeyboardEvent) {
    const el = e.target as HTMLElement
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (el.closest("input, textarea, select, [contenteditable=true]")) return
    if (scale) {
      if (!/^[0-9.]$/.test(e.key) && !(e.key === "-" && scale.min < 0)) return
      e.preventDefault()
      typeIn(e.key)
    } else if (/^[1-9]$/.test(e.key)) {
      const l = tracker.legend[Number(e.key) - 1]
      if (!l) return
      e.preventDefault()
      mark(day, marks[day] === l.key ? null : l.key)
    }
  }

  return (
    <section
      onKeyDown={onKeyDown}
      className="rounded-2xl border border-white/[0.07] bg-panel p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-xl text-ink">{tracker.name}</h3>
          <p className="mt-1 text-sm text-stone-400">
            {inYear.length} {inYear.length === 1 ? "day" : "days"} answered in{" "}
            {year}
            {scale && average !== null && (
              <> · on average {formatScale(scale, average)}</>
            )}
            .
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

      {/* answering: the main thing here, so first */}
      <div
        className={`mt-4 rounded-xl border px-4 py-3 ${
          other
            ? "border-white/20 bg-white/[0.03]"
            : "border-ember/30 bg-ember/[0.04]"
        }`}
      >
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm">
            <span
              className={`font-mono text-[11px] uppercase tracking-widest ${other ? "text-stone-300" : "text-ember"}`}
            >
              {other ? niceDay(day) : "Today"}
            </span>
            <span className="text-stone-500">
              {" "}
              · {answerOf(marks[day])?.label ?? "not answered yet"}
            </span>
          </p>
          {other ? (
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="text-xs text-stone-400 underline hover:text-stone-200"
            >
              Back to today
            </button>
          ) : (
            <span className="text-xs text-stone-500">
              Another day? Pick it in the grid
              <span className="pointer-coarse:hidden">, then type</span>.
            </span>
          )}
        </div>
        {scale ? (
          <ScaleAnswer
            key={`${day}:${marks[day] ?? ""}:${typing?.times ?? 0}`}
            typing={typing?.text}
            scale={scale}
            value={numberOf(marks[day])}
            onSet={(n) => mark(day, n === null ? null : String(n))}
          />
        ) : (
          picker(day)
        )}
      </div>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}

      {/* the grid, with (in the slideshow) an arrow each side */}
      <div className="mt-4 flex items-center gap-2 sm:gap-4">
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
                      const answer = answerOf(marks[k])
                      const future = k > today
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={future}
                          onClick={() => {
                            const again = open === k
                            setOpen(again ? null : k)
                            // a scale: straight to typing its number
                            if (scale && !again) typeIn("")
                            else setTyping(undefined)
                          }}
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

      {scale ? (
        // the key, under the grid: lowest to highest
        <div className="mt-3 flex items-center gap-2 text-xs text-stone-500">
          <span>
            {formatScale(scale, scale.min)}
            {scale.low.label && ` · ${scale.low.label}`}
          </span>
          <span
            aria-hidden
            className="h-2 w-24 rounded-full sm:w-40"
            style={{
              background: `linear-gradient(to right, ${scale.low.color}, ${scale.high.color})`,
            }}
          />
          <span>
            {scale.high.label && `${scale.high.label} · `}
            {formatScale(scale, scale.max)}
          </span>
        </div>
      ) : (
        <>
          {/* the key, under the grid: pick an answer to light only its days */}
          <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-stone-600">
              Show only
            </span>
            {tracker.legend.map((l) => {
              const active = focus === l.key
              return (
                <button
                  key={l.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFocus(active ? null : l.key)}
                  className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition pointer-coarse:py-1.5 ${
                    active
                      ? "bg-white/10 text-ink"
                      : "text-stone-500 hover:text-stone-200"
                  } ${focus && !active ? "opacity-40" : ""}`}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-sm"
                    style={{ background: l.color }}
                  />
                  {l.label}
                  <span className="font-mono text-stone-600">
                    {counts.get(l.key) ?? 0}
                  </span>
                </button>
              )
            })}
            {focus && (
              <button
                type="button"
                onClick={() => setFocus(null)}
                className="px-1.5 text-xs text-stone-500 underline hover:text-stone-300"
              >
                Show all
              </button>
            )}
          </div>
        </>
      )}
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

// ---- today, on the home page ----------------------------------------------
// Each tracker's answer for today, as a row of little squares (the colours
// of its year grid) to tap as soon as you open the app.

// the squares for a scale: each step (if there are few), or points spread
// along it
function scalePoints(scale: Scale) {
  const steps = scale.step ? (scale.max - scale.min) / scale.step + 1 : 0
  const n = steps && steps <= 11 ? Math.round(steps) : 7
  return Array.from(
    { length: n },
    (_, i) =>
      scaleValue(scale, scale.min + ((scale.max - scale.min) * i) / (n - 1)) ??
      scale.min,
  )
}

function Square({
  color,
  on,
  label,
  onClick,
}: {
  color: string
  on: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`h-4 w-4 rounded-[3px] transition pointer-coarse:h-6 pointer-coarse:w-6 ${
        on
          ? "scale-110 ring-2 ring-ink ring-offset-1 ring-offset-[#151516]"
          : "opacity-60 hover:scale-110 hover:opacity-100"
      }`}
      style={{ background: color }}
    />
  )
}

export function TodayTrackers() {
  const { trackers, today, set } = useTrackers()
  const [error, setError] = useState("")
  // (null: the tables aren't set up)
  if (!trackers) return null

  async function mark(t: TrackerView, value: string | null) {
    const before = t.marks
    const marks = { ...t.marks }
    if (value) marks[today] = value
    else delete marks[today]
    const put = (m: Record<string, string>) =>
      set((all) => all.map((x) => (x.id === t.id ? { ...x, marks: m } : x)))
    put(marks)
    const { ok } = await send(`/api/trackers/${t.id}/marks`, "PUT", {
      day: today,
      value,
    })
    if (!ok) {
      put(before)
      setError(`Couldn't save "${t.name}". Try again.`)
    } else setError("")
  }

  // a tracker's answer today, in words
  const answer = (t: TrackerView) => {
    const v = t.marks[today]
    if (v === undefined) return null
    if (t.scale) {
      const n = scaleValue(t.scale, v)
      return n === null ? null : formatScale(t.scale, n)
    }
    return t.legend.find((l) => l.key === v)?.label ?? null
  }
  const done = trackers.filter((t) => answer(t) !== null).length

  return (
    <section aria-labelledby="today-trackers" className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="today-trackers" className="font-serif text-2xl text-ink">
          Today&rsquo;s check-in
        </h2>
        <p className="text-xs text-stone-500">
          {niceDay(today)}
          {trackers.length > 0 && (
            <>
              {" · "}
              {done === trackers.length
                ? "all done ✓"
                : `${done} of ${trackers.length}`}
            </>
          )}
          {" · "}
          <Link href="/trackers" className="underline hover:text-stone-300">
            {trackers.length ? "All trackers" : "Add a tracker"}
          </Link>
        </p>
      </div>

      {trackers.length === 0 ? (
        <p className="text-sm text-stone-500">
          Nothing to track yet: add one (sleep, mood, anything) and answer it
          here each day.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {trackers.map((t) => {
            const said = answer(t)
            const value = t.marks[today]
            const number = t.scale ? scaleValue(t.scale, value) : null
            return (
              <li
                key={t.id}
                className="rounded-xl border border-white/[0.07] bg-panel px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-stone-200">{t.name}</p>
                  {t.scale ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-stone-500">
                      {/* the number, exactly (any in range) */}
                      <input
                        key={value ?? ""}
                        inputMode="decimal"
                        defaultValue={number ?? ""}
                        placeholder="#"
                        aria-label={`${t.name}: exact number, ${t.scale.min} to ${t.scale.max}`}
                        onKeyDown={(e) =>
                          e.key === "Enter" && e.currentTarget.blur()
                        }
                        onBlur={(e) => {
                          const raw = e.currentTarget.value.trim()
                          if (!raw) return number !== null && mark(t, null)
                          const n = scaleValue(t.scale!, raw)
                          if (n === null)
                            return setError(
                              `${t.name}: a number from ${formatScale(t.scale!, t.scale!.min)} to ${formatScale(t.scale!, t.scale!.max)}.`,
                            )
                          if (n !== number) mark(t, String(n))
                        }}
                        className="h-5 w-12 rounded-md border border-white/10 bg-transparent px-1.5 text-center text-xs text-stone-200 outline-none focus:border-white/30 pointer-coarse:h-8"
                      />
                      {t.scale.unit}
                    </span>
                  ) : (
                    <p
                      className={`shrink-0 text-xs ${said ? "text-stone-300" : "text-stone-600"}`}
                    >
                      {said ?? "–"}
                    </p>
                  )}
                </div>
                <div
                  role="group"
                  aria-label={`${t.name}: today's answer`}
                  className="mt-2 flex flex-wrap items-center gap-1 pointer-coarse:gap-1.5"
                >
                  {t.scale ? (
                    <>
                      {scalePoints(t.scale).map((n) => (
                        <Square
                          key={n}
                          color={scaleColor(t.scale!, n)}
                          on={number === n}
                          label={formatScale(t.scale!, n)}
                          onClick={() =>
                            mark(t, number === n ? null : String(n))
                          }
                        />
                      ))}
                    </>
                  ) : (
                    t.legend.map((l) => (
                      <Square
                        key={l.key}
                        color={l.color}
                        on={value === l.key}
                        label={l.label}
                        onClick={() => mark(t, value === l.key ? null : l.key)}
                      />
                    ))
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
    </section>
  )
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
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-2xl sm:h-11 sm:w-11 leading-none text-stone-200 transition hover:border-white/30 hover:bg-white/10"
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

// ---- the "Day by day" section (Trackers tab) ------------------------------
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
            // days whose answer it still has (an answer, or a number on
            // the scale)
            const fits = (v: string) =>
              changed.scale
                ? scaleValue(changed.scale, v) !== null
                : keys.has(v)
            set((all) =>
              all.map((x) =>
                x.id === tracker.id
                  ? {
                      ...x,
                      ...changed,
                      marks: Object.fromEntries(
                        Object.entries(x.marks).filter(([, v]) => fits(v)),
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
            const { ok, data } = await send(
              `/api/trackers/${tracker.id}`,
              "DELETE",
            )
            if (!ok) return
            set((all) => all.filter((x) => x.id !== tracker.id))
            choose(slides[index - 1] ?? WRITING)
            showUndo({
              label: `Deleted “${tracker.name}”`,
              token: data?.undo,
              // back in the slideshow, where it was
              onUndo: () => {
                set((all) =>
                  all.some((x) => x.id === tracker.id)
                    ? all
                    : [
                        ...all.slice(0, index - 1),
                        tracker,
                        ...all.slice(index - 1),
                      ],
                )
                choose(tracker.id)
              },
            })
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
