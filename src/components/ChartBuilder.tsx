"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Chart } from "@/components/Chart"
import { computeChart, type InsightNote } from "@/features/insights/compute"
import {
  CHARTS,
  defaultTitle,
  GROUP_LABEL,
  GROUPS,
  MEASURE_LABEL,
  MEASURES,
  parseSpec,
  SPLIT_LABEL,
  SPLITS,
  type ChartSpec,
} from "@/features/insights/spec"
import {
  HIGHLIGHT_CATEGORIES,
  PURPOSE_NAMES,
  TOPIC_NAMES,
} from "@/features/notes/lib/topics"

// Charts worth a look. A few are suggested at a time; choosing one swaps in
// a fresh set.
type Preset = { label: string; spec: Partial<ChartSpec> }
const PRESETS: Preset[] = [
  {
    label: "Words written per month",
    spec: { measure: "words", groupBy: "month", chart: "line" },
  },
  {
    label: "Which weekdays I write",
    spec: { measure: "entries", groupBy: "weekday" },
  },
  {
    label: "Kinds of highlights",
    spec: { measure: "highlights", groupBy: "category" },
  },
  {
    label: "Why I write, over time",
    spec: {
      measure: "entries",
      groupBy: "month",
      splitBy: "purpose",
      chart: "area",
      normalize: true,
    },
  },
  {
    label: "Highlight types per topic",
    spec: { measure: "highlights", groupBy: "topic", splitBy: "category" },
  },
  {
    label: "Entries per week",
    spec: { measure: "entries", groupBy: "week", chart: "line" },
  },
  {
    label: "Words by weekday",
    spec: { measure: "words", groupBy: "weekday" },
  },
  {
    label: "Highlights each month",
    spec: { measure: "highlights", groupBy: "month", splitBy: "category" },
  },
  {
    label: "Which categories I write most",
    spec: { measure: "entries", groupBy: "purpose" },
  },
  {
    label: "Words per category",
    spec: { measure: "words", groupBy: "purpose" },
  },
  {
    label: "Kinds of highlights, over time",
    spec: {
      measure: "highlights",
      groupBy: "month",
      splitBy: "category",
      chart: "area",
      normalize: true,
    },
  },
  {
    label: "Year by year",
    spec: { measure: "entries", groupBy: "year", splitBy: "purpose" },
  },
  {
    label: "Weekdays by category",
    spec: { measure: "entries", groupBy: "weekday", splitBy: "purpose" },
  },
  {
    label: "Highlight kinds per category",
    spec: { measure: "highlights", groupBy: "purpose", splitBy: "category" },
  },
]
const SHOWN = 5

// a few suggestions you haven't just been shown (or just chosen)
function pickPresets(avoid: Preset[]) {
  const fresh = PRESETS.filter((p) => !avoid.includes(p))
  const pool = fresh.length >= SHOWN ? fresh : PRESETS
  return [...pool].sort(() => Math.random() - 0.5).slice(0, SHOWN)
}

export type SavedChartView = { id: string; spec: ChartSpec }

function Select<T extends string>({
  label,
  value,
  options,
  names,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  names?: Record<string, string>
  onChange: (v: T) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-stone-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-white/10 bg-[#161617] px-2.5 py-1.5 text-sm text-stone-200"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {names?.[o] ?? (o ? o[0].toUpperCase() + o.slice(1) : "Any")}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ChartBuilder({
  notes,
  saved,
  editId,
}: {
  notes: InsightNote[]
  saved: SavedChartView[]
  // a pinned chart to open for editing (from Stats → Edit)
  editId?: string
}) {
  const router = useRouter()
  const editing = saved.find((c) => c.id === editId)
  const [spec, setSpec] = useState<ChartSpec>(
    () => editing?.spec ?? parseSpec({ groupBy: "month" }),
  )
  const [customTitle, setCustomTitle] = useState(Boolean(editing))
  const [question, setQuestion] = useState("")
  // the same first few on the server and in the browser; shuffled after
  const [presets, setPresets] = useState(() => PRESETS.slice(0, SHOWN))
  // the question the AI built the current chart from
  const [askedFor, setAskedFor] = useState("")
  const [status, setStatus] = useState("")
  const [asking, setAsking] = useState(false)

  const data = useMemo(() => computeChart(spec, notes), [spec, notes])

  // Re-validate after every edit so impossible combinations fix themselves.
  function update(patch: Partial<ChartSpec>) {
    setAskedFor("")
    setSpec((prev) => {
      const next = parseSpec({
        ...prev,
        ...patch,
        filter: { ...prev.filter, ...patch.filter },
      })
      return customTitle ? next : { ...next, title: defaultTitle(next) }
    })
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault()
    if (!question.trim()) return
    setAsking(true)
    setStatus("")
    const res = await fetch("/api/explore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }).catch(() => null)
    const body = await res?.json().catch(() => null)
    setAsking(false)
    if (!res?.ok || !body?.spec) {
      setStatus(body?.error ?? "Could not reach the server.")
      return
    }
    setSpec(parseSpec(body.spec))
    setCustomTitle(true)
    setAskedFor(question)
  }

  async function pin() {
    const res = await fetch("/api/charts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    })
    // re-pinning a chart opened for editing replaces the old one
    if (res.ok && editing)
      await fetch(`/api/charts/${editing.id}`, { method: "DELETE" })
    setStatus(
      res.ok ? "Pinned to the Stats overview." : "Could not pin this chart.",
    )
    router.refresh()
  }

  return (
    <div className="space-y-10">
      <form
        onSubmit={ask}
        className="rounded-2xl border border-white/[0.07] bg-panel p-5"
      >
        <label htmlFor="ask" className="font-serif text-xl text-ink">
          Ask for a chart
        </label>
        <p className="mt-1 text-sm text-stone-400">
          Describe what you want to see. The AI picks the chart; the numbers
          always come from your entries.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            id="ask"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Do I write about work more on weekdays?"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-stone-100 outline-none focus:border-white/30"
          />
          <button
            type="submit"
            disabled={asking}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-stone-900 disabled:opacity-60"
          >
            {asking ? "Thinking…" : "Make chart"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setCustomTitle(false)
                setAskedFor("")
                const next = parseSpec({ ...preset.spec, filter: {} })
                setSpec({ ...next, title: preset.label })
                setPresets((shown) => pickPresets(shown))
              }}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-400 transition hover:bg-white/5 hover:text-stone-200"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </form>

      <section className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          <Select
            label="Measure"
            value={spec.measure}
            options={MEASURES}
            names={MEASURE_LABEL}
            onChange={(measure) => update({ measure })}
          />
          <Select
            label="Group by"
            value={spec.groupBy}
            options={GROUPS}
            names={GROUP_LABEL}
            onChange={(groupBy) => update({ groupBy })}
          />
          <Select
            label="Split by"
            value={spec.splitBy}
            options={SPLITS}
            names={SPLIT_LABEL}
            onChange={(splitBy) => update({ splitBy })}
          />
          <Select
            label="Chart"
            value={spec.chart}
            options={CHARTS}
            onChange={(chart) => update({ chart })}
          />
          <label
            className={`flex items-center gap-2 text-sm ${spec.splitBy === "none" ? "text-stone-600" : "text-stone-300"}`}
          >
            <input
              type="checkbox"
              checked={spec.normalize}
              disabled={spec.splitBy === "none"}
              onChange={(e) => update({ normalize: e.target.checked })}
            />
            Show as share (%)
          </label>
          <div className="space-y-3 border-t border-white/5 pt-3">
            <p className="text-xs uppercase tracking-widest text-stone-600">
              Only include
            </p>
            <Select
              label="Category"
              value={spec.filter.purpose ?? ""}
              options={["", ...PURPOSE_NAMES]}
              onChange={(purpose) =>
                update({ filter: { purpose: purpose || undefined } })
              }
            />
            <Select
              label="Topic"
              value={spec.filter.topic ?? ""}
              options={["", ...TOPIC_NAMES]}
              onChange={(topic) =>
                update({ filter: { topic: topic || undefined } })
              }
            />
            <Select
              label="Highlight type"
              value={spec.filter.category ?? ""}
              options={["", ...HIGHLIGHT_CATEGORIES]}
              onChange={(category) =>
                update({ filter: { category: category || undefined } })
              }
            />
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-panel p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <input
              aria-label="Chart title"
              value={spec.title}
              onChange={(e) => {
                setCustomTitle(true)
                setSpec({ ...spec, title: e.target.value })
              }}
              className="min-w-0 flex-1 bg-transparent font-serif text-xl text-ink outline-none"
            />
            <button
              type="button"
              onClick={pin}
              className="rounded-full border border-white/15 px-3 py-1 text-sm text-stone-200 transition hover:bg-white/5"
            >
              Pin to Stats
            </button>
          </div>
          {askedFor && (
            <p className="mb-4 text-xs text-stone-500">
              Chosen by the AI for “{askedFor}”. Adjust it with the controls.
            </p>
          )}
          <Chart data={data} kind={spec.chart} percent={spec.normalize} />
          {status && <p className="mt-3 text-xs text-stone-400">{status}</p>}
        </div>
      </section>

      {saved.length > 0 && (
        <p className="text-sm text-stone-400">
          {saved.length} {saved.length === 1 ? "chart is" : "charts are"} pinned
          to the{" "}
          <Link href="/stats#pinned" className="text-ember hover:underline">
            Stats overview
          </Link>
          .
        </p>
      )}
    </div>
  )
}
