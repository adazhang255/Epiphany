"use client"

import { showUndo } from "@/components/UndoToast"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { ANALYSIS_EVENT } from "@/components/AnalysisIndicator"
import { Walker } from "@/components/DraggableTimeline"
import { CategoryPicker } from "@/components/CategoryPicker"
import { FormatBar, formatKeyDown } from "@/components/FormatBar"
import { FormattedText, LiveFormatted } from "@/components/Formatted"
import { useHeaderSave } from "@/components/writeStatus"
import { SaveCancel } from "@/components/SaveCancel"
import { SENTIMENT_COLORS, SENTIMENT_LABELS } from "@/features/notes/lib/topics"
import {
  loadDraft,
  newEntryDraftKey,
  writeHref,
  saveDraft,
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

// `custom`: categories of your own already in use, offered beside the
// built-in ones. `draftId`: which of your drafts this is ("" for the first,
// which the notebook's blank page shares)
export function NoteComposer({
  custom,
  draftId = "",
}: {
  custom: string[]
  draftId?: string
}) {
  const router = useRouter()
  const draftKey = newEntryDraftKey(draftId)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(today)
  // "HH:MM", or "" for none given (then the time it's saved is shown)
  const [time, setTime] = useState("")
  const [content, setContent] = useState("")
  const box = useRef<HTMLTextAreaElement>(null)
  // the text formatted, instead of the text box
  const [preview, setPreview] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [tone, setTone] = useState<number | null>(null)
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = useState("")

  // the unsaved entry, kept as you type and brought back on return (the
  // notebook's blank page shares it, with highlights marked there)
  const [restored, setRestored] = useState(false)
  const [ready, setReady] = useState(false)
  const [fromDraft, setFromDraft] = useState<NewEntryDraft | null>(null)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reads browser storage, which the server can't */
    const d = loadDraft<NewEntryDraft>(draftKey)
    if (d) {
      setFromDraft(d)
      setTitle(d.title ?? "")
      setDate(d.date || today())
      setTime(d.time ?? "")
      setContent(d.content ?? "")
      setCategories(d.categories ?? [])
      setTone(d.tone ?? null)
      setRestored(Boolean(d.title?.trim() || d.content?.trim()))
    }
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [draftKey])
  const draft = useMemo<NewEntryDraft | null>(() => {
    if (!title.trim() && !content.trim()) return null
    const d = fromDraft
    // highlights marked on the blank page stay while the text they're in does
    const marked =
      d && d.content === content ? { marks: d.marks, ranges: d.ranges } : {}
    return {
      categories,
      tone,
      ...marked,
      title,
      date,
      time,
      content,
    }
  }, [title, date, time, content, categories, tone, fromDraft])
  const clearDraft = useDraftAutosave(draftKey, draft, ready)
  useUnsavedWarning(draft !== null && status === "idle")

  // Cancel: leave without it; "Undo" keeps it and comes back to it
  function cancel() {
    const was = draft
    clearDraft()
    if (was)
      showUndo({
        label: "Draft discarded",
        onUndo: () => {
          saveDraft(draftKey, was)
          router.push(writeHref(draftId))
        },
      })
    if (window.history.length > 1) router.back()
    else router.push("/")
  }

  async function save(event?: React.FormEvent) {
    event?.preventDefault()
    if (!content.trim()) {
      setError("Write something before saving.")
      // (saving from the header: the text box may be out of sight)
      setPreview(false)
      requestAnimationFrame(() => box.current?.focus())
      return
    }

    setError("")
    setStatus("saving")
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        date,
        time,
        ownCategory: categories,
        sentiment: tone,
      }),
    })
    if (!res.ok) {
      setStatus("idle")
      setError("Could not save right now. Please try again.")
      return
    }
    const note = (await res.json()) as { id: string }
    // highlights marked on the notebook's blank page, if this draft came
    // from there (added once the entry exists; if that fails, the entry
    // page says so)
    const marked =
      draft?.marks?.length && draft.ranges
        ? draft.marks
            .filter((m) => draft.ranges?.[m.key])
            .map((m) => ({
              quote: content.slice(
                draft.ranges![m.key].start,
                draft.ranges![m.key].end,
              ),
              category: m.category,
            }))
        : []
    let missed = false
    if (marked.length) {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addedHighlights: marked }),
      }).catch(() => null)
      missed = !res?.ok
    }
    clearDraft()

    // Saved. Highlights are found in the background on the server; the
    // header shows progress, so there's nothing to wait for here.
    window.dispatchEvent(new Event(ANALYSIS_EVENT))
    setStatus("saved")
    await new Promise((r) => setTimeout(r, 700))
    router.push(
      `/notes/${note.id}?saved=1${missed ? "&missed=highlights" : ""}`,
    )
  }

  // grow with the writing, so it lines up with the formatted copy under it
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [content, preview])

  // the header's Write button saves this entry while it's on the page
  useHeaderSave(true, status, save)

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-stone-100 outline-none focus:border-white/30"

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_170px_130px]">
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
        <label className="block">
          <span className="mb-1.5 block text-sm text-stone-400">
            Time <span className="text-stone-600">(optional)</span>
          </span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </label>
      </div>

      <div>
        <div className="mb-1.5 flex items-end justify-between gap-3">
          <label htmlFor="entry-text" className="text-sm text-stone-400">
            Entry
          </label>
          <FormatBar box={box} preview={preview} onPreview={setPreview} />
        </div>
        {/* the text box sits on a copy of the text, formatted as you type */}
        <div className={preview ? "hidden" : "relative"}>
          <div
            aria-hidden
            className="notebook live-copy pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-transparent py-3 pr-4 font-serif text-[18px]"
          >
            <LiveFormatted parts={[{ text: content }]} />
            {"\u200b"}
          </div>
          <textarea
            id="entry-text"
            ref={box}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={formatKeyDown}
            rows={12}
            style={{ background: "transparent" }}
            className="notebook live-text relative block w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-white/10 py-3 pr-4 font-serif text-[18px] text-stone-100 outline-none focus:border-white/30"
          />
        </div>
        {preview && (
          <div
            onClick={() => setPreview(false)}
            title="Click to go back to writing"
            className="notebook min-h-[22rem] cursor-text whitespace-pre-wrap break-words rounded-xl border border-ember/25 py-3 pr-4 font-serif text-[18px] text-stone-200"
          >
            {content.trim() ? (
              <FormattedText text={content} />
            ) : (
              <span className="text-stone-600">Nothing written yet.</span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-sm text-stone-400">Category</span>
        <CategoryPicker
          custom={custom}
          selected={categories}
          onPick={(c) =>
            setCategories((all) =>
              all.includes(c)
                ? all.filter((x) => x !== c)
                : [...all, c].slice(-3),
            )
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-sm text-stone-400">Tone</span>
        <div
          role="radiogroup"
          aria-label="Overall tone"
          className="flex flex-wrap gap-1"
        >
          {[-2, -1, 0, 1, 2].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={tone === n}
              onClick={() => setTone((t) => (t === n ? null : n))}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition ${
                tone === n
                  ? "bg-white/15 text-ink ring-1 ring-white/30"
                  : "text-stone-300 hover:bg-white/10"
              }`}
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: SENTIMENT_COLORS[n] }}
              />
              {SENTIMENT_LABELS[n]}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-500">
          (left blank, your local AI reads it)
        </span>
      </div>

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
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 pt-2">
          <p
            className="mr-auto text-sm text-rose-300/80 empty:hidden"
            aria-live="polite"
          >
            {error}
          </p>
          {draft && !error && (
            <span className="mr-auto text-xs text-stone-500">
              {restored
                ? "Your unsaved draft, brought back"
                : "Draft kept as you type"}
            </span>
          )}
          <SaveCancel onSave={save} onCancel={cancel} saving={false} />
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
