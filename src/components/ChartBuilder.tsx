"use client"

import { PUBLIC_SITE } from "@/lib/site-mode"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { Chart } from "@/components/Chart"
import { useChartJobs } from "@/components/useChartJobs"
import type { ChartJob } from "@/features/insights/chartJobs"
import { cleanKeywords } from "@/features/insights/keywords"
import {
  nextDeal,
  presetsFor,
  shuffled,
  SHOWN,
  type Deck,
  type Preset,
} from "@/features/insights/presets"
import { pinChart } from "@/components/chartPins"
import { computeChart, type InsightNote } from "@/features/insights/compute"
import {
  CHARTS,
  defaultTitle,
  GROUP_LABEL,
  GROUPS,
  MEASURE_LABEL,
  MEASURES,
  keywordAxis,
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
  seed = 0,
}: {
  notes: InsightNote[]
  saved: SavedChartView[]
  // orders the suggestions (a new one each visit, the same on both sides)
  seed?: number
}) {
  const router = useRouter()
  // ?edit=<id>: change a pinned chart (read here, in the browser)
  const params = useSearchParams()
  const editId = params.get("edit") ?? undefined
  // ?chart=<id>: open a chart made in the background (from the header)
  const openId = params.get("chart")
  const editing = saved.find((c) => c.id === editId)
  const [spec, setSpec] = useState<ChartSpec>(
    () => editing?.spec ?? parseSpec({ groupBy: "month" }),
  )
  const [customTitle, setCustomTitle] = useState(Boolean(editing))
  const [question, setQuestion] = useState("")
  // suggestions, dealt a few at a time from a shuffled deck
  const allPresets = useMemo(() => presetsFor(notes), [notes])
  const [deck, setDeck] = useState<Deck>(() => ({
    order: shuffled(allPresets, seed),
    at: 0,
  }))
  const presets = deck.order.slice(deck.at, deck.at + SHOWN)
  const dealMore = () => setDeck((d) => nextDeal(d, allPresets, Math.random()))
  // the chart as it was last pinned (to show it's pinned, and not pin twice)
  const [pinned, setPinned] = useState<string | null>(null)
  const [pinning, setPinning] = useState(false)
  // the question the AI built the current chart from
  const [askedFor, setAskedFor] = useState("")
  const [status, setStatus] = useState("")
  const [asking, setAsking] = useState(false)
  // the keywords box as typed ("work, sl"), while it has focus
  const [keywordDraft, setKeywordDraft] = useState<string | null>(null)

  // Charts asked for are made in the background: ask several, leave the
  // page, come back. The one you just asked for opens by itself when it's
  // ready, unless you've changed the chart since; the rest wait in the list.
  const [shownId, setShownId] = useState<string | null>(null)
  const awaited = useRef<string | null>(null)
  const touched = useRef(false)
  function show(job: ChartJob) {
    if (!job.spec) return
    setSpec(parseSpec(job.spec))
    // its title says what it shows, so it follows your changes from here
    setCustomTitle(false)
    setAskedFor(job.question)
    setStatus("")
    setShownId(job.id)
  }
  const {
    jobs,
    ask: askInBackground,
    dismiss,
  } = useChartJobs(!PUBLIC_SITE, (all, finished, first) => {
    if (first && openId) {
      const job = all.find((j) => j.id === openId && j.state === "done")
      if (job) show(job)
    }
    const mine = finished.find((j) => j.id === awaited.current)
    if (mine?.state === "done" && !touched.current) show(mine)
  })

  const data = useMemo(() => computeChart(spec, notes), [spec, notes])

  // Re-validate after every edit so impossible combinations fix themselves.
  function update(patch: Partial<ChartSpec>) {
    touched.current = true
    setAskedFor("")
    setStatus("")
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
    const job = await askInBackground(question.trim())
    setAsking(false)
    if (typeof job === "string") return setStatus(job)
    awaited.current = job.id
    touched.current = false
    setQuestion("")
  }

  function choosePreset(preset: Preset) {
    touched.current = true
    setCustomTitle(false)
    setAskedFor("")
    setStatus("")
    const next = parseSpec({ ...preset.spec, filter: preset.spec.filter ?? {} })
    setSpec({ ...next, title: preset.label })
    dealMore()
  }

  const isPinned = pinned === JSON.stringify(spec)
  // pin it to Stats; a pinned chart opened for editing is replaced
  async function pin() {
    if (pinning || isPinned) return
    setPinning(true)
    setStatus("")
    const id = await pinChart(spec, editing?.id)
    setPinning(false)
    if (!id) return setStatus("Couldn't pin this chart. Is the app running?")
    setPinned(JSON.stringify(spec))
    // the old one is gone: this is now an ordinary chart again
    if (editing) router.replace("/custom", { scroll: false })
    router.refresh()
  }

  return (
    <div className="space-y-10">
      <div className="rounded-2xl border border-white/[0.07] bg-panel p-5">
        {/* asking needs the local AI, which the public site doesn't have */}
        {!PUBLIC_SITE && (
          <form onSubmit={ask} className="mb-4">
            <label htmlFor="ask" className="font-serif text-xl text-ink">
              Ask for a chart
            </label>
            <p className="mt-1 text-sm text-stone-400">
              Describe what you want to see, keywords and dates included. The AI
              picks the chart; the numbers always come from your entries.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                id="ask"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How often do I mention coffee, by month?"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-stone-100 outline-none focus:border-white/30"
              />
              <button
                type="submit"
                disabled={asking || !question.trim()}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-stone-900 disabled:opacity-60"
              >
                {asking ? "Asking…" : "Make chart"}
              </button>
            </div>
            {jobs.length > 0 && (
              <ul aria-label="Charts asked for" className="mt-4 space-y-1.5">
                {jobs.map((job) => (
                  <li
                    key={job.id}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-sm ${
                      job.id === shownId
                        ? "border-ember/40 bg-ember/[0.05]"
                        : "border-white/[0.07]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-stone-200">
                      “{job.question}”
                    </span>
                    <span className="text-xs text-stone-500" aria-live="polite">
                      {job.state === "queued" ? (
                        "Waiting its turn…"
                      ) : job.state === "running" ? (
                        "Making it…"
                      ) : job.state === "error" ? (
                        <span className="text-rose-300">{job.error}</span>
                      ) : job.id === shownId ? (
                        "Shown below"
                      ) : (
                        "Ready"
                      )}
                    </span>
                    {job.state === "done" && job.id !== shownId && (
                      <button
                        type="button"
                        onClick={() => {
                          touched.current = false
                          show(job)
                        }}
                        className="rounded-full bg-ink px-3 py-0.5 text-xs font-medium text-stone-900"
                      >
                        Show
                      </button>
                    )}
                    {(job.state === "done" || job.state === "error") && (
                      <button
                        type="button"
                        onClick={() => {
                          if (job.id === shownId) setShownId(null)
                          void dismiss(job.id)
                        }}
                        aria-label={`Dismiss “${job.question}”`}
                        className="text-stone-500 hover:text-stone-200"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
                {jobs.some(
                  (j) => j.state === "queued" || j.state === "running",
                ) && (
                  <li className="px-1 text-xs text-stone-500">
                    Made in the background by your local AI: ask more, or leave
                    this page and come back.
                  </li>
                )}
              </ul>
            )}
          </form>
        )}
        <p className="mb-2 text-xs uppercase tracking-widest text-stone-600">
          Try
        </p>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => choosePreset(preset)}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-400 transition hover:bg-white/5 hover:text-stone-200"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={dealMore}
            title="Show other suggestions"
            className="rounded-full px-3 py-1 text-xs text-stone-500 transition hover:text-stone-200"
          >
            ↻ More ideas
          </button>
        </div>
      </div>

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
            <div className="grid grid-cols-2 gap-2">
              {(["after", "before"] as const).map((edge) => (
                <label key={edge} className="block">
                  <span className="mb-1 block text-xs text-stone-500">
                    {edge === "after" ? "From" : "To"}
                  </span>
                  <input
                    type="date"
                    value={spec.filter[edge] ?? ""}
                    onChange={(e) =>
                      update({
                        filter: { [edge]: e.target.value || undefined },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#161617] px-2 py-1.5 text-sm text-stone-200 [color-scheme:dark]"
                  />
                </label>
              ))}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-stone-500">
                Keywords
              </span>
              <input
                value={keywordDraft ?? spec.keywords.join(", ")}
                onChange={(e) => {
                  setKeywordDraft(e.target.value)
                  update({ keywords: cleanKeywords(e.target.value) })
                }}
                onBlur={() => setKeywordDraft(null)}
                placeholder="e.g. work, sleep, sam"
                className="w-full rounded-lg border border-white/10 bg-[#161617] px-2.5 py-1.5 text-sm text-stone-200 placeholder:text-stone-600"
              />
              <span className="mt-1 block text-[11px] leading-snug text-stone-600">
                {keywordAxis(spec)
                  ? "Counted in your entries' text. Empty: your most used words."
                  : "Only entries that mention one of these."}
              </span>
            </label>
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
            {!PUBLIC_SITE &&
              (isPinned ? (
                <Link
                  href="/stats#pinned"
                  className="rounded-full border border-ember/40 px-3 py-1 text-sm text-ember transition hover:bg-ember/10"
                >
                  ✓ Pinned · see it on Stats
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={pin}
                  disabled={pinning}
                  className="rounded-full border border-white/15 px-3 py-1 text-sm text-stone-200 transition hover:bg-white/5 disabled:opacity-50"
                >
                  {pinning
                    ? "Pinning…"
                    : editing
                      ? "Update pinned chart"
                      : "Pin to Stats"}
                </button>
              ))}
          </div>
          {editing && !isPinned && (
            <p className="mb-4 text-xs text-stone-500">
              Editing the pinned chart “{editing.spec.title}”: updating replaces
              it on Stats.{" "}
              <Link href="/custom" className="underline hover:text-stone-300">
                Stop editing
              </Link>
            </p>
          )}
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
