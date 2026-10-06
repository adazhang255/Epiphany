"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ANALYSIS_EVENT } from "@/components/AnalysisIndicator"

type Proposed = {
  title: string
  date: string | null
  dateFrom: "document" | "ai" | null
  content: string
  duplicate: boolean
  keep: boolean
}

type Source = "file" | "link" | "text"

const TABS: { id: Source; label: string }[] = [
  { id: "file", label: "Upload a file" },
  { id: "link", label: "Google Doc link" },
  { id: "text", label: "Paste text" },
]

export function ImportWizard() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<Source>("file")
  const [link, setLink] = useState("")
  const [text, setText] = useState("")
  const [single, setSingle] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState("")
  const [modelError, setModelError] = useState("")

  const [stage, setStage] = useState<
    "pick" | "reading" | "review" | "importing" | "done"
  >("pick")
  const [error, setError] = useState("")
  const [docName, setDocName] = useState("")
  const [entries, setEntries] = useState<Proposed[]>([])
  const [analyze, setAnalyze] = useState(true)
  const [progress, setProgress] = useState({ done: 0, total: 0, note: "" })

  useEffect(() => {
    fetch("/api/import/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setModelError(data.error)
        else {
          setModels(data.models)
          setModel(data.default ?? "")
        }
      })
      .catch(() => setModelError("Could not reach the server."))
  }, [])

  async function read(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    const form = new FormData()
    form.set("model", model)
    form.set("single", String(single))
    if (source === "file") {
      const file = fileInput.current?.files?.[0]
      if (!file) return setError("Choose a file first.")
      form.set("file", file)
    } else if (source === "link") {
      if (!link.trim()) return setError("Paste a Google Docs link first.")
      form.set("url", link)
    } else {
      if (!text.trim()) return setError("Paste some text first.")
      form.set("text", text)
    }

    setStage("reading")
    const res = await fetch("/api/import/preview", {
      method: "POST",
      body: form,
    }).catch(() => null)
    const body = await res?.json().catch(() => null)
    if (!res?.ok || !body) {
      setError(body?.error ?? "Could not read that document.")
      setStage("pick")
      return
    }
    setDocName(body.source)
    setEntries(
      (body.entries as Omit<Proposed, "keep">[]).map((e) => ({
        ...e,
        keep: !e.duplicate,
      })),
    )
    setStage("review")
  }

  function edit(i: number, patch: Partial<Proposed>) {
    setEntries((list) => list.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  }

  // The model's split points aren't always right: fold an entry into the one before.
  function mergeUp(i: number) {
    setEntries((list) =>
      list.flatMap((e, j) => {
        if (j === i) return []
        if (j === i - 1) {
          return [
            {
              ...e,
              content: `${e.content}\n\n${list[i].content}`,
              duplicate: false,
            },
          ]
        }
        return [e]
      }),
    )
  }

  async function commit() {
    const chosen = entries.filter((e) => e.keep)
    setStage("importing")
    setProgress({ done: 0, total: chosen.length, note: "Saving entries…" })
    // Saved at once; highlights are found in the background on the server
    // (progress shows in the header), so there's no waiting here.
    const res = await fetch("/api/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: docName,
        entries: chosen,
        analyze,
        model,
      }),
    }).catch(() => null)
    const body = await res?.json().catch(() => null)
    if (!res?.ok || !body?.ids) {
      setError(body?.error ?? "Import failed.")
      setStage("review")
      return
    }
    if (analyze) window.dispatchEvent(new Event(ANALYSIS_EVENT))
    setProgress((p) => ({ ...p, done: p.total }))
    setStage("done")
  }

  const kept = entries.filter((e) => e.keep).length

  if (stage === "done") {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-panel p-8 text-center">
        <p className="font-serif text-2xl text-ink">
          Imported {progress.total} {progress.total === 1 ? "entry" : "entries"}
        </p>
        {analyze && (
          <p className="mt-2 text-sm text-stone-400">
            Highlights are being found in the background. Progress shows at the
            top of the page, so feel free to move on.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-rose-300/80">{error}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-stone-900"
          >
            See the timeline
          </Link>
          <button
            type="button"
            onClick={() => {
              setStage("pick")
              setEntries([])
              setError("")
            }}
            className="rounded-full border border-white/15 px-5 py-2 text-sm text-stone-200"
          >
            Import another
          </button>
        </div>
      </div>
    )
  }

  if (stage === "review" || stage === "importing") {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              From “{docName}”
            </p>
            <p className="mt-1 text-stone-300">
              Found {entries.length}{" "}
              {entries.length === 1 ? "entry" : "entries"}. Check titles and
              dates, untick anything to skip.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStage("pick")}
            disabled={stage === "importing"}
            className="text-sm text-stone-500 underline hover:text-stone-300"
          >
            Start over
          </button>
        </div>

        <ul className="space-y-3">
          {entries.map((entry, i) => (
            <li
              key={i}
              className={`rounded-xl border p-4 ${entry.keep ? "border-white/[0.09] bg-panel" : "border-white/[0.04] opacity-60"}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="checkbox"
                  aria-label="Import this entry"
                  checked={entry.keep}
                  onChange={(e) => edit(i, { keep: e.target.checked })}
                  className="h-4 w-4 accent-[#e8c27a]"
                />
                <input
                  aria-label="Title"
                  value={entry.title}
                  onChange={(e) => edit(i, { title: e.target.value })}
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 font-serif text-lg text-ink outline-none hover:border-white/10 focus:border-white/30"
                />
                <input
                  type="date"
                  aria-label="Date"
                  value={entry.date ?? ""}
                  onChange={(e) =>
                    edit(i, { date: e.target.value || null, dateFrom: null })
                  }
                  className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-stone-200"
                />
                <span className="w-28 text-xs text-stone-500">
                  {entry.date
                    ? entry.dateFrom === "document"
                      ? "date from doc"
                      : entry.dateFrom === "ai"
                        ? "date found by AI"
                        : "date set by you"
                    : "no date: uses today"}
                </span>
              </div>
              {i > 0 && stage === "review" && (
                <button
                  type="button"
                  onClick={() => mergeUp(i)}
                  className="mt-2 text-xs text-stone-500 underline hover:text-stone-300"
                >
                  Merge with previous entry
                </button>
              )}
              {entry.duplicate && (
                <p className="mt-2 text-xs text-amber-300/80">
                  Already in your journal, so it’s unticked.
                </p>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-stone-400">
                  {entry.content.slice(0, 180)}
                  {entry.content.length > 180 ? "…" : ""}{" "}
                  <span className="text-xs text-stone-600">
                    ({entry.content.split(/\s+/).length} words)
                  </span>
                </summary>
                <p className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 font-serif text-[15px] leading-relaxed text-stone-300">
                  {entry.content}
                </p>
              </details>
            </li>
          ))}
        </ul>

        <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#161617]/95 p-4 backdrop-blur">
          <label className="flex items-center gap-2 text-sm text-stone-300">
            <input
              type="checkbox"
              checked={analyze}
              onChange={(e) => setAnalyze(e.target.checked)}
            />
            Find highlights, topics and tags with {model}
          </label>
          {stage === "importing" ? (
            <span className="text-sm text-stone-300">{progress.note}</span>
          ) : (
            <button
              type="button"
              onClick={commit}
              disabled={kept === 0}
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-stone-900 disabled:opacity-40"
            >
              Import {kept} {kept === 1 ? "entry" : "entries"}
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-rose-300/80">{error}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={read} className="space-y-6">
      <div className="flex gap-6 border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSource(tab.id)}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
              source === tab.id
                ? "border-ember text-ink"
                : "border-transparent text-stone-500 hover:text-stone-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {source === "file" && (
        <div className="space-y-2">
          <input
            ref={fileInput}
            type="file"
            accept=".docx,.md,.markdown,.txt,.html,.htm"
            className="block w-full text-sm text-stone-300 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-stone-100"
          />
          <p className="text-xs text-stone-500">
            In Google Docs: File → Download → Microsoft Word (.docx) or Markdown
            (.md). The file never leaves this computer.
          </p>
        </div>
      )}
      {source === "link" && (
        <div className="space-y-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://docs.google.com/document/d/…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-stone-100 outline-none focus:border-white/30"
          />
          <p className="text-xs text-stone-500">
            The doc must be shared as “Anyone with the link can view”. The app
            downloads it from Google, then only your local model reads it. For
            private docs, download the file instead.
          </p>
        </div>
      )}
      {source === "text" && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Paste a document here"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-serif text-stone-100 outline-none focus:border-white/30"
        />
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1 block text-xs text-stone-500">Local model</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#161617] px-3 py-2 text-sm text-stone-200"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-stone-300">
          <input
            type="checkbox"
            checked={single}
            onChange={(e) => setSingle(e.target.checked)}
          />
          Treat the whole document as one entry
        </label>
        <button
          type="submit"
          disabled={stage === "reading" || !model}
          className="ml-auto rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-stone-900 disabled:opacity-50"
        >
          {stage === "reading" ? `Reading with ${model}…` : "Read document"}
        </button>
      </div>
      {stage === "reading" && (
        <p className="text-sm text-stone-400">
          Splitting it into entries and naming them. Long documents can take a
          few minutes.
        </p>
      )}
      {modelError && <p className="text-sm text-rose-300/80">{modelError}</p>}
      {error && <p className="text-sm text-rose-300/80">{error}</p>}
    </form>
  )
}
