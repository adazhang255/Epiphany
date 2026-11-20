"use client"

import { showUndo } from "@/components/UndoToast"

import { PUBLIC_SITE } from "@/lib/site-mode"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import {
  HighlightMenu,
  menuForMark,
  menuForSelection,
  type MenuState,
} from "@/components/HighlightMenu"
import { announceAnalysis } from "@/components/useAnalysisBusy"
import { findQuote, snapToWords } from "@/features/notes/lib/findQuote"
import {
  caretEnd,
  pickerSpot,
  spotStyle,
  type PickerSpot,
} from "@/features/notes/lib/caret"
import {
  follow,
  markUp,
  tint,
  tinted,
  type Range,
} from "@/features/notes/lib/ranges"
import {
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
  categoryColor,
  categoryGlyph,
  highlightType,
} from "@/features/notes/lib/topics"
import { DeleteEntryButton } from "@/components/DeleteEntryButton"
import { CategoryPicker } from "@/components/CategoryPicker"
import { NotebookTitle } from "@/components/NotebookTitle"
import { OnTop } from "@/components/OnTop"
import { EntryTime } from "@/components/EntryTime"
import { Formatted } from "@/components/Formatted"
import { useHeaderSave } from "@/components/writeStatus"
import { SaveCancel } from "@/components/SaveCancel"
import { DraftTabs } from "@/components/DraftTabs"
import { FormatBar, formatKeyDown } from "@/components/FormatBar"
import { FormattedText, LiveFormatted } from "@/components/Formatted"
import { formatFlags, plainText } from "@/features/notes/lib/markdown"
import { dayKey } from "@/features/notes/lib/time"
import { trackerAnswer } from "@/features/trackers/legend"
import type { TrackerView } from "@/features/trackers/trackers"
import {
  loadDraft,
  newEntryDraftKey,
  useDraftAutosave,
  useUnsavedWarning,
  type NewEntryDraft,
} from "@/components/useDraft"
import type {
  NotebookFilter,
  NotebookNote,
} from "@/features/notes/services/notes.service"

// Paper tints, so each entry reads as its own sheet: warm, cool, cream, grey.
const PAPERS = [
  "rgb(255 250 240 / 0.035)",
  "rgb(235 242 255 / 0.03)",
  "rgb(255 244 214 / 0.04)",
  "rgb(255 255 255 / 0.025)",
]

// A stable number from an id, so a page keeps its look between visits.
function seed(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

// One entry as one sheet of the same ruled paper as the Write page: red
// margin, binder holes, text on the lines, a page number at the foot. Short
// entries still get a full page (10px + 13 lines of 30px, so the footer sits
// on a line), with the time it was written at the foot. Click the page to
// open the entry; Edit (bottom right) rewrites it in place.
function Page({
  note,
  sorting,
  custom,
  trackers,
  onDeleted,
  onRestored,
}: {
  note: NotebookNote
  // your trackers: that day's answers sit at the foot of the page
  trackers: TrackerView[]
  // it should leave the list (deleted, or given a category while sorting)
  onDeleted: () => void
  // its delete was undone: back in the list
  onRestored: () => void
  // in the Uncategorized view: say why it's here
  sorting: boolean
  // categories of your own, offered when giving one in the Uncategorized view
  custom: string[]
}) {
  const router = useRouter()
  // the category you give it here (Uncategorized view), shown at once
  const [chosen, setChosen] = useState<string[]>([])
  const [saveError, setSaveError] = useState("")
  // highlights, kept up to date as you mark them here
  const [highlights, setHighlights] = useState(note.highlights)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const page = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  async function choose(name: string) {
    const next = chosen.includes(name)
      ? chosen.filter((c) => c !== name)
      : [...chosen, name].slice(-3)
    setChosen(next)
    setSaveError("")
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownCategory: next }),
    }).catch(() => null)
    if (!res?.ok) return setSaveError("Couldn't save the category.")
    // in the Uncategorized view, a sorted entry leaves the list
    if (sorting && next.length > 0) onDeleted()
  }
  // the day's tracker answers (the day it's dated, in your time zone)
  const day = dayKey(new Date(note.date))
  const answered = trackers.some((t) => trackerAnswer(t, t.marks[day]))
  const s = seed(note.id)

  // Editing happens on the entry's own page: clicking anywhere on this
  // page opens it there, ready to edit (unless you clicked a control or a
  // highlight, or were selecting text to mark it).
  // (on the public site, a page just opens the entry)
  const editHref = PUBLIC_SITE
    ? `/notes/${note.id}`
    : `/notes/${note.id}?edit=1`
  function open(e: React.MouseEvent) {
    if (
      (e.target as HTMLElement).closest(
        "a, button, input, textarea, label, form, mark, [role=alertdialog], [role=dialog]",
      )
    )
      return
    if (window.getSelection()?.toString()) return
    if (menu) return setMenu(null)
    router.push(editHref)
  }

  // select words on the page to mark them
  function onMouseUp() {
    if (PUBLIC_SITE || !textRef.current || !page.current) return
    const next = menuForSelection(textRef.current, page.current)
    if (next) setMenu(next)
  }

  return (
    <article
      ref={page}
      id={`n-${note.id}`}
      onClick={open}
      onMouseUp={onMouseUp}
      title={PUBLIC_SITE ? "Open" : "Edit"}
      className="notebook notebook-page group relative flex cursor-pointer flex-col rounded-sm pr-6 font-serif text-[18px] text-stone-200 transition hover:ring-1 hover:ring-ember/60"
      style={{
        backgroundColor: PAPERS[s % PAPERS.length],
      }}
    >
      {[0.12, 0.5, 0.88].map((at) => (
        <span
          key={at}
          aria-hidden
          className="absolute left-3.5 h-3 w-3 rounded-full bg-[#0e0e0f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
          style={{ top: `${at * 100}%` }}
        />
      ))}

      <>
        {/* the title on exactly one ruled line (its day is the date above
            the page) */}
        <header className="flex h-[30px] items-center gap-3">
          <NotebookTitle noteId={note.id} title={note.title} />
        </header>

        <div ref={textRef} className="whitespace-pre-wrap break-words">
          <MarkedText
            text={note.content}
            highlights={highlights}
            onMark={
              PUBLIC_SITE
                ? undefined
                : (el, id, category) =>
                    page.current &&
                    setMenu(menuForMark(el, page.current, id, category))
            }
          />
        </div>
        {menu && (
          <HighlightMenu
            noteId={note.id}
            menu={menu}
            custom={custom}
            onClose={closeMenu}
            onChanged={setHighlights}
          />
        )}

        {/* actions first, on one line that never wraps; tags last, free
              to wrap onto more lines, so they give way instead of the buttons */}
        <footer className="mt-auto">
          {/* Uncategorized view: give the entry a category right here */}
          {sorting && !PUBLIC_SITE && (
            <div className="flex min-h-[30px] flex-wrap items-center gap-x-2 gap-y-1 py-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
                {chosen.length ? "Category:" : "Give it a category:"}
              </span>
              <CategoryPicker
                custom={custom}
                selected={chosen}
                onPick={choose}
              />
              {saveError && (
                <span className="font-mono text-[11px] text-rose-300">
                  {saveError}
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3">
            {/* that day's trackers (on a narrow page, lines of their own) */}
            <TrackerPills
              trackers={trackers}
              day={day}
              className={`min-w-0 basis-full sm:flex-1 sm:basis-0 ${answered ? "flex" : "hidden sm:flex"}`}
            />
            {/* Edit and Delete only while you're on the page (always
                there on a touch screen, which can't hover) */}
            <span className="flex shrink-0 items-center gap-3 font-mono text-[11px] opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
              {!PUBLIC_SITE && (
                <Link
                  href={editHref}
                  className="uppercase tracking-widest text-stone-400 hover:text-ember"
                >
                  Edit
                </Link>
              )}
              <DeleteEntryButton
                noteId={note.id}
                title={note.title}
                onDeleted={onDeleted}
                onRestored={onRestored}
              />
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[11px] text-stone-500">
              {note.sentiment !== null && SENTIMENT_LABELS[note.sentiment] && (
                <span
                  title={`Tone: ${SENTIMENT_LABELS[note.sentiment]}`}
                  className="h-2 w-2 rounded-full"
                  style={{ background: SENTIMENT_COLORS[note.sentiment] }}
                >
                  <span className="sr-only">
                    Tone: {SENTIMENT_LABELS[note.sentiment]}
                  </span>
                </span>
              )}
              {/* (its day is the date above it) */}
              <EntryTime date={note.date} createdAt={note.createdAt} />
            </span>
          </div>
        </footer>
      </>
    </article>
  )
}

// The entry's text with its highlights tinted in, by type, like on the
// entry's own page (where you change them). Ones whose words aren't found
// in the text any more are left out.
function MarkedText({
  text,
  highlights,
  onMark,
}: {
  text: string
  highlights: NotebookNote["highlights"]
  // a highlight was clicked
  onMark?: (el: HTMLElement, id: string, category: string) => void
}) {
  const found = highlights
    .map((h) => ({ h, range: findQuote(text, h.quote) }))
    .filter(
      (f): f is typeof f & { range: NonNullable<typeof f.range> } =>
        f.range !== null,
    )
    .sort((a, b) => a.range.start - b.range.start)
  const flags = formatFlags(text)
  const parts: React.ReactNode[] = []
  let at = 0
  for (const { h, range } of found) {
    if (range.start < at) continue // overlaps one already shown
    if (range.start > at)
      parts.push(
        <Formatted
          key={`t${at}`}
          text={text}
          flags={flags}
          start={at}
          end={range.start}
        />,
      )
    const type = highlightType(h.category)
    const color = categoryColor(type)
    parts.push(
      <mark
        key={h.id}
        title={`${categoryGlyph(type)} ${type}${onMark ? ": click to change" : ""}`}
        onClick={(e) => {
          if (!onMark || window.getSelection()?.toString()) return
          onMark(e.currentTarget, h.id, type)
        }}
        className={`rounded-sm text-inherit ${onMark ? "cursor-pointer" : ""}`}
        style={{
          background: tint(color, 0.16),
          boxShadow: `inset 0 -2px 0 ${tint(color, 0.8)}`,
        }}
      >
        <Formatted
          text={text}
          flags={flags}
          start={range.start}
          end={range.end}
        />
      </mark>,
    )
    at = range.end
  }
  parts.push(<Formatted key={`t${at}`} text={text} flags={flags} start={at} />)
  return <>{parts}</>
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// A blank page at the top of the notebook to write a new entry on: same
// ruled paper, title on the first line, then the text. You can give it a
// category and tone, and mark highlights (select words; a type picker pops
// up beside them). Saving adds it all to the notebook; anything you leave
// out is found in the background, as for any new entry.
// `draftId`: which of your drafts this page is ("" for the first, which
// the Write page shares)
function BlankPage({
  onSaved,
  custom,
  draftId,
}: {
  onSaved: () => void
  custom: string[]
  draftId: string
}) {
  const draftKey = newEntryDraftKey(draftId)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(todayIso)
  // "HH:MM", or "" for none given (then the time it's saved is shown)
  const [time, setTime] = useState("")
  const [content, setContent] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [tone, setTone] = useState<number | null>(null)
  // highlights you mark, and where each sits in the text (moves with edits)
  const [marks, setMarks] = useState<{ key: string; category: string }[]>([])
  const [ranges, setRanges] = useState<Record<string, Range>>({})
  // the selection, and the end of it the cursor is at
  const [sel, setSel] = useState<(Range & { caret: number }) | null>(null)
  const [anchor, setAnchor] = useState<PickerSpot | null>(null)
  const [saving, setSaving] = useState(false)
  // a moment of "Saved ✓" in the header, once it's in the notebook
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState("")
  const box = useRef<HTMLTextAreaElement>(null)
  // the text formatted, instead of the text box
  const [preview, setPreview] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const copy = useRef<HTMLDivElement>(null)
  const nextKey = useRef(0)

  // the unsaved page, kept as you write (clicking another page, filtering or
  // leaving doesn't lose it) and brought back here or on Write
  const [ready, setReady] = useState(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reads browser storage, which the server can't */
    const d = loadDraft<NewEntryDraft>(draftKey)
    if (d) {
      setTitle(d.title ?? "")
      setDate(d.date || todayIso())
      setTime(d.time ?? "")
      setContent(d.content ?? "")
      setCategories(d.categories ?? [])
      setTone(d.tone ?? null)
      setMarks(d.marks ?? [])
      setRanges(d.ranges ?? {})
      nextKey.current =
        Math.max(
          -1,
          ...(d.marks ?? []).map((m) => Number(m.key.slice(2)) || 0),
        ) + 1
    }
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [draftKey])
  const draft = useMemo<NewEntryDraft | null>(
    () =>
      title.trim() || content.trim()
        ? { title, date, time, content, categories, tone, marks, ranges }
        : null,
    [title, date, time, content, categories, tone, marks, ranges],
  )
  const clearDraft = useDraftAutosave(draftKey, draft, ready)
  useUnsavedWarning(draft !== null && !saving)

  // gone at once; "Undo" brings it all back
  function discard() {
    const was = {
      title,
      date,
      time,
      content,
      categories,
      tone,
      marks,
      ranges,
    }
    clearDraft()
    reset()
    showUndo({
      label: "Page discarded",
      onUndo: () => {
        setTitle(was.title)
        setDate(was.date)
        setTime(was.time)
        setContent(was.content)
        setCategories(was.categories)
        setTone(was.tone)
        setMarks(was.marks)
        setRanges(was.ranges)
      },
    })
  }

  // grow with the writing, so the text stays on the lines
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.max(el.scrollHeight, 300)}px`
  }, [content])

  function readSelection() {
    const el = box.current
    if (!el) return
    setSel(
      el.selectionEnd > el.selectionStart
        ? {
            start: el.selectionStart,
            end: el.selectionEnd,
            caret: caretEnd(el),
          }
        : null,
    )
  }
  // a text box's selection isn't always reported through its own events
  useEffect(() => {
    const onChange = () => {
      if (document.activeElement === box.current) readSelection()
    }
    document.addEventListener("selectionchange", onChange)
    return () => document.removeEventListener("selectionchange", onChange)
  }, [])

  // the type picker sits just under the cursor at the end of the selection
  useLayoutEffect(() => {
    const host = wrap.current
    const model = copy.current
    if (!sel || !host || !model) {
      setAnchor(null)
      return
    }
    setAnchor(pickerSpot(host, model, content, sel.caret))
  }, [sel, content])

  // mark the selected words (whole words) as this type; highlights they
  // overlap are replaced
  function mark(category: string) {
    if (!sel) return
    const r = snapToWords(content, sel)
    const key = `m-${nextKey.current++}`
    const hit = new Set(
      marks
        .filter((m) => ranges[m.key])
        .filter(
          (m) => ranges[m.key].start < r.end && r.start < ranges[m.key].end,
        )
        .map((m) => m.key),
    )
    setMarks((all) => [
      ...all.filter((m) => !hit.has(m.key)),
      { key, category },
    ])
    setRanges((all) => ({ ...all, [key]: r }))
    setSel(null)
  }

  const items = marks
    .filter((m) => ranges[m.key])
    .map((m) => ({ id: m.key, category: m.category }))
  const parts = markUp(content, items, ranges)

  function reset() {
    setTitle("")
    setContent("")
    setDate(todayIso())
    setTime("")
    setCategories([])
    setTone(null)
    setMarks([])
    setRanges({})
    setSel(null)
  }

  async function save() {
    if (!content.trim()) {
      setPreview(false)
      requestAnimationFrame(() => box.current?.focus())
      return setError("Write something first.")
    }
    setSaving(true)
    setError("")
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        content,
        date,
        time,
        ownCategory: categories,
        sentiment: tone,
      }),
    }).catch(() => null)
    const note = res?.ok ? await res.json().catch(() => null) : null
    if (!note?.id) {
      setSaving(false)
      return setError("Couldn't save. Is the server running?")
    }
    clearDraft()
    // the highlights you marked, added now the entry exists
    let missed = false
    if (items.length) {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addedHighlights: items.map((h) => ({
            quote: content.slice(ranges[h.id].start, ranges[h.id].end),
            category: h.category,
          })),
        }),
      }).catch(() => null)
      missed = !res?.ok
    }
    setSaving(false)
    reset()
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1500)
    if (missed)
      setError(
        "Saved, but the highlights you marked couldn't be added. Mark them again on the entry.",
      )
    announceAnalysis()
    onSaved()
  }

  // the header's Write button saves this page while there's writing on it
  useHeaderSave(
    draft !== null || saving || justSaved,
    saving ? "saving" : justSaved ? "saved" : "idle",
    save,
  )

  const label =
    "w-16 shrink-0 font-mono text-[10px] uppercase tracking-widest text-stone-500"

  return (
    <article
      aria-label="A blank page for a new entry"
      className="notebook notebook-page relative flex min-h-[400px] flex-col rounded-sm pr-6 font-serif text-[18px] text-stone-200 ring-1 ring-ember/25"
      style={{ backgroundColor: "rgb(255 250 240 / 0.04)" }}
      onKeyDown={(e) => {
        if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          save()
        }
      }}
    >
      {[0.12, 0.5, 0.88].map((at) => (
        <span
          key={at}
          aria-hidden
          className="absolute left-3.5 h-3 w-3 rounded-full bg-[#0e0e0f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
          style={{ top: `${at * 100}%` }}
        />
      ))}
      {/* on a narrow page it wraps, a ruled line per row */}
      <header className="flex flex-wrap items-center gap-x-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A new page…"
          aria-label="Title"
          className="h-[30px] min-w-0 flex-1 basis-40 bg-transparent text-[22px] leading-[30px] text-ink outline-none placeholder:text-stone-600"
        />
        <FormatBar
          box={box}
          preview={preview}
          onPreview={setPreview}
          className="h-[30px] shrink-0"
        />
        <div className="ml-auto flex h-[30px] shrink-0 items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date"
            className="shrink-0 bg-transparent font-mono text-[11px] uppercase leading-none tracking-widest text-stone-500 outline-none [color-scheme:dark]"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Time (optional)"
            title="Time (optional): left blank, it's the time you save"
            className="shrink-0 bg-transparent font-mono text-[11px] uppercase leading-none tracking-widest text-stone-500 outline-none [color-scheme:dark]"
          />
        </div>
      </header>

      {preview && (
        <div
          onClick={() => setPreview(false)}
          title="Click to go back to writing"
          className="flex-1 cursor-text whitespace-pre-wrap break-words leading-[30px] text-stone-100"
        >
          {content.trim() ? (
            <FormattedText text={content} />
          ) : (
            <span className="text-stone-600">Nothing written yet.</span>
          )}
        </div>
      )}
      {/* the text, on a tinted copy that shows the highlights you mark */}
      <div ref={wrap} className={preview ? "hidden" : "relative flex-1"}>
        <div
          ref={copy}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words leading-[30px] live-copy"
        >
          <LiveFormatted parts={parts.map(tinted)} />
          {"\u200b"}
        </div>
        <textarea
          ref={box}
          value={content}
          onChange={(e) => {
            const next = e.target.value
            setRanges((r) => follow(r, content, next))
            setContent(next)
          }}
          onSelect={readSelection}
          onMouseUp={readSelection}
          onKeyDown={formatKeyDown}
          onKeyUp={readSelection}
          placeholder="Write here… select words to mark them as a highlight"
          aria-label="Write a new entry"
          rows={10}
          style={{ background: "transparent" }}
          className="live-text relative block w-full resize-none overflow-hidden whitespace-pre-wrap break-words leading-[30px] text-stone-100 outline-none placeholder:text-stone-600"
        />
        {anchor && sel && (
          <OnTop>
            <div
              role="dialog"
              aria-label="Mark the selection"
              className="absolute z-[70] w-max max-w-[min(24rem,90vw)] font-sans rounded-xl border border-white/15 bg-stone-900/95 p-2 font-sans shadow-xl backdrop-blur"
              style={spotStyle(anchor)}
            >
              <p className="px-1 pb-1.5 text-[11px] text-stone-400">Mark as</p>
              <CategoryPicker custom={custom} onPick={mark} />
            </div>
          </OnTop>
        )}
      </div>

      {/* category and tone, each on its own ruled line */}
      <div className="flex min-h-[30px] flex-wrap items-center gap-x-3 font-sans">
        <span className={label}>Category</span>
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
      <div className="flex min-h-[30px] flex-wrap items-center gap-x-3 font-sans">
        <span className={label}>Tone</span>
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
      </div>

      <footer className="flex min-h-[30px] flex-wrap items-center gap-x-3 pb-1.5">
        {/* its own line on phones, the buttons under it */}
        <span className="min-w-[14rem] flex-1 font-mono text-[11px] leading-[30px] text-stone-500">
          {error ? (
            <span className="text-rose-300">{error}</span>
          ) : (
            <>
              {items.length > 0 &&
                `${items.length} highlight${items.length === 1 ? "" : "s"} · `}
              <span className="pointer-coarse:hidden">⌘S to save · </span>
              anything left blank is filled in for you
            </>
          )}
        </span>
        <SaveCancel
          compact
          className="ml-auto"
          onSave={save}
          onCancel={draft ? discard : undefined}
          saving={saving}
          canSave={Boolean(content.trim())}
        />
      </footer>
    </article>
  )
}

// today's date, read in the browser (the server's day may not be yours)
const noChange = () => () => {}
const todayKey = () => dayKey(new Date())

// Pages written on this day in other years, taped in above the notebook:
// the latest few, each a short strip of the same paper (the same width and
// writing as the pages) that unfolds to the whole entry.
function YearsAgo({ notes }: { notes: NotebookNote[] }) {
  const today = useSyncExternalStore(noChange, todayKey, () => null)
  if (!today) return null
  const year = Number(today.slice(0, 4))
  const found = notes
    .map((n) => ({ note: n, key: dayKey(new Date(n.date)) }))
    .filter(({ key }) => key.slice(5) === today.slice(5) && key < today)
    .slice(0, 3)
  if (!found.length) return null
  return (
    <section aria-label="On this day" className="mb-12 space-y-8">
      {found.map(({ note, key }, i) => (
        <Slip
          key={note.id}
          note={note}
          ago={year - Number(key.slice(0, 4))}
          i={i}
        />
      ))}
      <Link
        href="/on-this-day"
        className="inline-block font-mono text-[11px] uppercase tracking-widest text-stone-400 hover:text-stone-200"
      >
        Everything from this day →
      </Link>
    </section>
  )
}

function Slip({
  note,
  ago,
  i,
}: {
  note: NotebookNote
  ago: number
  i: number
}) {
  const [open, setOpen] = useState(false)
  const text = plainText(note.content)
  const long = text.length > 220 || text.split("\n").length > 3
  return (
    <article
      className="notebook notebook-page relative rounded-sm pr-6 font-serif text-[18px] text-stone-200"
      style={{
        backgroundColor: PAPERS[seed(note.id) % PAPERS.length],
        transform: `rotate(${i % 2 ? 0.5 : -0.7}deg)`,
      }}
    >
      {/* strips of tape holding it in */}
      <span
        aria-hidden
        className="absolute -top-3 left-[18%] h-6 w-24 -rotate-6 rounded-[2px] bg-[rgb(255_244_214/0.14)] shadow-[0_1px_2px_rgb(0_0_0/0.3)]"
      />
      <span
        aria-hidden
        className="absolute -top-3 right-[14%] h-6 w-20 rotate-[5deg] rounded-[2px] bg-[rgb(255_244_214/0.14)] shadow-[0_1px_2px_rgb(0_0_0/0.3)]"
      />
      <p className="flex h-[30px] items-center gap-3 font-mono text-[11px] uppercase tracking-widest">
        <span className="rounded-sm bg-ember/15 px-1.5 leading-5 text-ember">
          {ago === 1 ? "1 year" : `${ago} years`} ago today
        </span>
        <span className="truncate text-stone-500">{longDate(note.date)}</span>
      </p>
      <h2 className="truncate text-[22px] leading-[30px] text-ink">
        <Link href={`/notes/${note.id}`} className="hover:underline">
          {note.title || "Untitled"}
        </Link>
      </h2>
      {open ? (
        <div className="whitespace-pre-wrap break-words">
          <FormattedText text={note.content} />
        </div>
      ) : (
        <p className="line-clamp-3 break-words">{text}</p>
      )}
      <p className="flex h-[30px] items-center gap-4 font-mono text-[11px] uppercase tracking-widest">
        {long && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="uppercase tracking-widest text-ember hover:text-ink"
          >
            {open ? "Fold it back ↑" : "Read it all ↓"}
          </button>
        )}
        <Link
          href={`/notes/${note.id}`}
          className="text-stone-500 hover:text-stone-200"
        >
          Open the entry →
        </Link>
      </p>
    </article>
  )
}

// A day's tracker answers: each a pill in its answer's colour, named.
function TrackerPills({
  trackers,
  day,
  className = "",
}: {
  trackers: TrackerView[]
  day: string
  className?: string
}) {
  const answered = trackers.flatMap((t) => {
    const a = trackerAnswer(t, t.marks[day])
    return a ? [{ tracker: t, answer: a }] : []
  })
  return (
    <ul
      aria-label="That day's trackers"
      className={`flex-wrap items-center gap-x-2 ${className}`}
    >
      {answered.map(({ tracker, answer }) => (
        <li key={tracker.id} className="flex h-[30px] min-w-0 items-center">
          <Link
            href={`/trackers?show=${encodeURIComponent(tracker.id)}`}
            title={`${tracker.name}: ${answer.label}`}
            className="flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-sans text-xs normal-case leading-5 tracking-normal transition hover:brightness-125"
            style={{
              background: tint(answer.color, 0.16),
              borderColor: tint(answer.color, 0.55),
            }}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: answer.color }}
            />
            <span className="max-w-[7rem] truncate text-stone-400 sm:max-w-[10rem]">
              {tracker.name}
            </span>
            <span className="shrink-0 font-medium text-stone-100">
              {answer.label}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// A small divider above each day's pages: the day's date on the left
// edge (Today or Yesterday picked out), then a thin line across.
function DayDivider({ day, count }: { day: string; count: number }) {
  const today = useSyncExternalStore(noChange, todayKey, () => null)
  const yesterday = today
    ? dayKey(new Date(new Date(`${today}T12:00:00`).getTime() - 864e5))
    : null
  const near = day === today ? "Today" : day === yesterday ? "Yesterday" : null
  return (
    <h2 className="mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-stone-500">
      <span className="shrink-0">
        {near && <span className="text-ember">{near} · </span>}
        {niceDay(day)}
        {count > 1 && ` · ${count} pages`}
      </span>
      <span aria-hidden className="h-px flex-1 bg-white/10" />
    </h2>
  )
}

// Pages in a row written the same day (in your time zone), together.
function days(notes: NotebookNote[]) {
  const out: { day: string; pages: NotebookNote[] }[] = []
  for (const note of notes) {
    const day = dayKey(new Date(note.date))
    const last = out.at(-1)
    if (last?.day === day) last.pages.push(note)
    else out.push({ day, pages: [note] })
  }
  return out
}

// "Fri, November 13, 2026"
const niceDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

// Endless scroll: the next pages load as you near the bottom.
// pages added each time you reach the bottom
const PAGE = 6

export function NotebookFeed({
  notes: all,
  filter,
  custom = [],
  category,
  q,
  trackers = [],
}: {
  // the entries to show (already filtered and searched), in order
  notes: NotebookNote[]
  // your trackers, for each day's answers at the foot of its pages
  trackers?: TrackerView[]
  filter: NotebookFilter
  category?: string
  q?: string
  // categories of your own (for giving uncategorized entries one)
  custom?: string[]
}) {
  const router = useRouter()
  // which of your drafts the blank page shows ("" the first)
  const [draftId, setDraftId] = useState("")
  // pages are added a few at a time as you scroll down
  const [count, setCount] = useState(PAGE)
  // entries deleted (or sorted away) here, gone at once
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const notes = all.filter((n) => !gone.has(n.id))
  const more = count < notes.length
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinel.current
    if (!el || !more) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setCount((c) => c + PAGE)
      },
      { rootMargin: "800px 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [more])

  if (notes.length === 0 && filter === "uncategorized") {
    return (
      <p className="text-stone-400">
        Every entry has a category. Nothing left to sort.
      </p>
    )
  }

  // a blank page to write on, at the top of the whole notebook (not while
  // filtering or searching)
  const writable = filter === "all" && !category && !q
  // a page just written: load the notebook again, with it on top
  function reload() {
    router.refresh()
  }
  const blank =
    writable && !PUBLIC_SITE ? (
      <>
        <DraftTabs
          current={draftId}
          onPick={setDraftId}
          className="justify-center"
        />
        <BlankPage
          key={draftId}
          draftId={draftId}
          onSaved={reload}
          custom={custom}
        />
      </>
    ) : null

  if (notes.length === 0 && writable) return <div>{blank}</div>

  if (notes.length === 0) {
    return (
      <p className="text-stone-400">
        The notebook is empty.
        {!PUBLIC_SITE && (
          <>
            {" "}
            <Link href="/write" className="text-ember hover:underline">
              Write the first page
            </Link>
            .
          </>
        )}
      </p>
    )
  }

  // (in a day's tray, its trackers are shown once, above its pages)
  const page = (note: NotebookNote, withTrackers = true) => (
    <Page
      note={note}
      sorting={filter === "uncategorized"}
      custom={custom}
      trackers={withTrackers ? trackers : []}
      onDeleted={() => setGone((g) => new Set(g).add(note.id))}
      onRestored={() =>
        setGone((g) => {
          const next = new Set(g)
          next.delete(note.id)
          return next
        })
      }
    />
  )

  return (
    <div>
      {blank && <div className="mb-12">{blank}</div>}
      {writable && <YearsAgo notes={notes} />}
      {/* one column of pages, all the same width; each day under a small
          divider with its date */}
      <ol className="space-y-12">
        {days(notes.slice(0, count)).map(({ day, pages }) => (
          <li key={`${day}-${pages[0].id}`}>
            <DayDivider day={day} count={pages.length} />
            <section aria-label={`${pages.length} ${pages.length === 1 ? "page" : "pages"} on ${niceDay(day)}`}>
              {/* the day's trackers, once for all its pages */}
              {pages.length > 1 && (
                <TrackerPills
                  trackers={trackers}
                  day={day}
                  className="-mt-2 mb-3 flex"
                />
              )}
              <ol className="space-y-6">
                {pages.map((note) => (
                  <li key={note.id}>
                    {page(note, pages.length === 1)}
                  </li>
                ))}
              </ol>
            </section>
          </li>
        ))}
      </ol>
      <div
        ref={sentinel}
        className="py-12 text-center font-mono text-xs uppercase tracking-widest text-stone-600"
      >
        {more
          ? "Turning the page…"
          : filter === "uncategorized"
            ? "— that's all of them —"
            : "— the first page —"}
      </div>
    </div>
  )
}
