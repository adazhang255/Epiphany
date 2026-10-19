"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ANALYSIS_EVENT } from "@/components/AnalysisIndicator"
import { Walker } from "@/components/DraggableTimeline"
import {
  NEW_ENTRY_DRAFT,
  confirmDiscard,
  loadDraft,
  useDraftAutosave,
  useUnsavedWarning,
  type NewEntryDraft,
} from "@/components/useDraft"

const PROMPTS = [
  "What moment today deserves a second look?",
  "What have you changed your mind about lately?",
  "What would you tell your past self this week?",
  "What question keeps coming back to you?",
]

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function NoteComposer() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(today)
  const [content, setContent] = useState("")
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = useState("")

  // the unsaved entry, kept as you type and brought back on return (the
  // notebook's blank page shares it, with highlights marked there)
  const [restored, setRestored] = useState(false)
  const [ready, setReady] = useState(false)
  const [fromDraft, setFromDraft] = useState<NewEntryDraft | null>(null)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reads browser storage, which the server can't */
    const d = loadDraft<NewEntryDraft>(NEW_ENTRY_DRAFT)
    if (d) {
      setFromDraft(d)
      setTitle(d.title ?? "")
      setDate(d.date || today())
      setContent(d.content ?? "")
      setRestored(Boolean(d.title?.trim() || d.content?.trim()))
    }
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
  const draft = useMemo<NewEntryDraft | null>(() => {
    if (!title.trim() && !content.trim()) return null
    const d = fromDraft
    // highlights marked on the blank page stay while the text they're in does
    const marked =
      d && d.content === content ? { marks: d.marks, ranges: d.ranges } : {}
    return {
      categories: d?.categories,
      tone: d?.tone,
      ...marked,
      title,
      date,
      content,
    }
  }, [title, date, content, fromDraft])
  const clearDraft = useDraftAutosave(NEW_ENTRY_DRAFT, draft, ready)
  useUnsavedWarning(draft !== null && status === "idle")

  function discard() {
    if (!confirmDiscard("this entry")) return
    clearDraft()
    setFromDraft(null)
    setTitle("")
    setContent("")
    setDate(today())
    setRestored(false)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!content.trim()) {
      setError("Write something before saving.")
      return
    }

    setError("")
    setStatus("saving")
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, date }),
    })
    if (!res.ok) {
      setStatus("idle")
      setError("Could not save right now. Please try again.")
      return
    }
    const note = (await res.json()) as { id: string }
    // what was chosen for it on the notebook's blank page, if this draft
    // came from there: category, tone, highlights
    const extra = {
      ...(draft?.categories?.length ? { ownCategory: draft.categories } : {}),
      ...(draft?.tone != null ? { sentiment: draft.tone } : {}),
      ...(draft?.marks?.length && draft.ranges
        ? {
            addedHighlights: draft.marks
              .filter((m) => draft.ranges?.[m.key])
              .map((m) => ({
                quote: content.slice(
                  draft.ranges![m.key].start,
                  draft.ranges![m.key].end,
                ),
                category: m.category,
              })),
          }
        : {}),
    }
    if (Object.keys(extra).length) {
      await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extra),
      }).catch(() => null)
    }
    clearDraft()

    // Saved. Highlights are found in the background on the server; the
    // header shows progress, so there's nothing to wait for here.
    window.dispatchEvent(new Event(ANALYSIS_EVENT))
    setStatus("saved")
    await new Promise((r) => setTimeout(r, 700))
    router.push(`/notes/${note.id}?saved=1`)
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-stone-100 outline-none focus:border-white/30"

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-stone-400">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A thought"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-stone-400">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm text-stone-400">Entry</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="notebook w-full resize-y rounded-xl border border-white/10 py-3 pr-4 font-serif text-[18px] text-stone-100 outline-none focus:border-white/30"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() =>
              setContent((c) => (c ? `${c}\n\n${prompt}\n` : `${prompt}\n`))
            }
            className="rounded-full border border-white/10 px-3 py-1.5 font-serif text-sm text-stone-400 transition hover:bg-white/5 hover:text-stone-200"
          >
            {prompt}
          </button>
        ))}
      </div>

      {status === "idle" ? (
        <div className="flex items-center justify-between gap-4 pt-2">
          <p className="text-sm text-rose-300/80" aria-live="polite">
            {error}
          </p>
          <span className="ml-auto flex items-center gap-3">
            {draft && (
              <span className="text-xs text-stone-500">
                {restored
                  ? "Your unsaved draft, brought back · "
                  : "Draft kept as you type · "}
                <button
                  type="button"
                  onClick={discard}
                  className="underline decoration-dotted hover:text-stone-300"
                >
                  discard
                </button>
              </span>
            )}
            <button
              type="submit"
              className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-stone-900 transition hover:bg-white"
            >
              Save entry
            </button>
          </span>
        </div>
      ) : (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-2xl border border-ember/30 bg-ember/[0.05] py-4"
        >
          {status === "saved" ? (
            <>
              <span className="save-tick text-xl text-ember">✓</span>
              <span className="save-fade text-stone-100">
                Saved. Highlights will appear in the background.
              </span>
            </>
          ) : (
            <>
              <Walker walking flipped={false} />
              <span className="text-stone-300">Saving…</span>
            </>
          )}
        </div>
      )}
    </form>
  )
}
