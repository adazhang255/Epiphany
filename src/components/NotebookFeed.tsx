"use client"

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
import { follow, markUp, tint, type Range } from "@/features/notes/lib/ranges"
import {
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
  categoryColor,
  categoryGlyph,
  highlightType,
} from "@/features/notes/lib/topics"
import { PurposeBadges } from "@/components/PurposeBadges"
import { DeleteEntryButton } from "@/components/DeleteEntryButton"
import { CategoryPicker } from "@/components/CategoryPicker"
import { NotebookTitle } from "@/components/NotebookTitle"
import { OnTop } from "@/components/OnTop"
import { timeOfDay as entryTime } from "@/features/notes/lib/time"
import {
  NEW_ENTRY_DRAFT,
  confirmDiscard,
  loadDraft,
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

const timeOfDay = (note: NotebookNote) =>
  entryTime(note.date, note.createdAt)

// One entry as one sheet of the same ruled paper as the Write page: red
// margin, binder holes, text on the lines, a page number at the foot. Short
// entries still get a full page (10px + 13 lines of 30px, so the footer sits
// on a line), with the time it was written at the foot. Click the page to
// open the entry; Edit (bottom right) rewrites it in place.
function Page({
  note,
  sorting,
  custom,
  onDeleted,
}: {
  note: NotebookNote
  // it should leave the list (deleted, or given a category while sorting)
  onDeleted: () => void
  // in the Uncategorized view: say why it's here
  sorting: boolean
  // categories of your own, offered when giving one in the Uncategorized view
  custom: string[]
}) {
  const router = useRouter()
  // the category you give it here (Uncategorized view), shown at once
  const [chosen, setChosen] = useState<string[]>([])
  const [saveError, setSaveError] = useState("")
  const purposes = chosen.length ? chosen : note.purposes
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
  const s = seed(note.id)
  const tilt = ((s % 13) - 6) / 10 // -0.6° … 0.6°

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
      className="notebook notebook-page group relative flex min-h-[400px] cursor-pointer flex-col rounded-sm pr-6 font-serif text-[18px] text-stone-200 transition hover:ring-1 hover:ring-ember/60"
      style={{
        backgroundColor: PAPERS[s % PAPERS.length],
        transform: `rotate(${tilt}deg)`,
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
        {/* title with its category beside it, on exactly one ruled line;
            the date sits on the right (at the foot on narrow screens) */}
        <header className="flex h-[30px] items-center gap-3">
          <NotebookTitle noteId={note.id} title={note.title} />
          <div className="flex shrink-0 [&>ul]:flex-nowrap">
            <PurposeBadges purposes={purposes} />
          </div>
          <time
            dateTime={note.date}
            className="ml-auto hidden shrink-0 font-mono text-[11px] uppercase leading-none tracking-widest text-stone-500 sm:block"
          >
            {longDate(note.date)}
          </time>
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
                withQuestion={false}
                onPick={choose}
              />
              {saveError && (
                <span className="font-mono text-[11px] text-rose-300">
                  {saveError}
                </span>
              )}
            </div>
          )}
          <div className="flex min-h-[30px] items-center gap-3">
            <div className="min-w-0 flex-1" />
            <span className="shrink-0 font-mono text-[11px] text-stone-500">
              <span className="sm:hidden">
                {new Date(note.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {timeOfDay(note) && " · "}
              </span>
              {timeOfDay(note)}
            </span>
            {!PUBLIC_SITE && (
              <Link
                href={editHref}
                className="shrink-0 rounded-md border border-ember/50 bg-ember/10 px-2.5 py-1 font-mono text-xs uppercase tracking-widest text-ember transition hover:border-ember hover:bg-ember/20"
              >
                ✎ Edit
              </Link>
            )}
            <DeleteEntryButton
              noteId={note.id}
              title={note.title}
              onDeleted={onDeleted}
              variant="outlined"
              className="shrink-0"
            />
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
  const parts: React.ReactNode[] = []
  let at = 0
  for (const { h, range } of found) {
    if (range.start < at) continue // overlaps one already shown
    if (range.start > at) parts.push(text.slice(at, range.start))
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
        {text.slice(range.start, range.end)}
      </mark>,
    )
    at = range.end
  }
  parts.push(text.slice(at))
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
function BlankPage({
  onSaved,
  custom,
}: {
  onSaved: () => void
  custom: string[]
}) {
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(todayIso)
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
  const [error, setError] = useState("")
  const box = useRef<HTMLTextAreaElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const copy = useRef<HTMLDivElement>(null)
  const nextKey = useRef(0)

  // the unsaved page, kept as you write (clicking another page, filtering or
  // leaving doesn't lose it) and brought back here or on Write
  const [ready, setReady] = useState(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reads browser storage, which the server can't */
    const d = loadDraft<NewEntryDraft>(NEW_ENTRY_DRAFT)
    if (d) {
      setTitle(d.title ?? "")
      setDate(d.date || todayIso())
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
  }, [])
  const draft = useMemo<NewEntryDraft | null>(
    () =>
      title.trim() || content.trim()
        ? { title, date, content, categories, tone, marks, ranges }
        : null,
    [title, date, content, categories, tone, marks, ranges],
  )
  const clearDraft = useDraftAutosave(NEW_ENTRY_DRAFT, draft, ready)
  useUnsavedWarning(draft !== null && !saving)

  function discard() {
    if (!confirmDiscard("this page")) return
    clearDraft()
    reset()
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
    setCategories([])
    setTone(null)
    setMarks([])
    setRanges({})
    setSel(null)
  }

  async function save() {
    if (!content.trim()) return setError("Write something first.")
    setSaving(true)
    setError("")
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        content,
        date,
      }),
    }).catch(() => null)
    const note = res?.ok ? await res.json().catch(() => null) : null
    if (!note?.id) {
      setSaving(false)
      return setError("Couldn't save. Is the server running?")
    }
    clearDraft()
    // what you chose for it: category, tone, highlights
    const extra = {
      ...(categories.length ? { ownCategory: categories } : {}),
      ...(tone !== null ? { sentiment: tone } : {}),
      ...(items.length
        ? {
            addedHighlights: items.map((h) => ({
              quote: content.slice(ranges[h.id].start, ranges[h.id].end),
              category: h.category,
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
    setSaving(false)
    reset()
    announceAnalysis()
    onSaved()
  }

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
      <header className="flex h-[30px] items-center gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A new page…"
          aria-label="Title"
          className="min-w-0 flex-1 bg-transparent text-[22px] leading-[30px] text-ink outline-none placeholder:text-stone-600"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className="shrink-0 bg-transparent font-mono text-[11px] uppercase leading-none tracking-widest text-stone-500 outline-none [color-scheme:dark]"
        />
      </header>

      {/* the text, on a tinted copy that shows the highlights you mark */}
      <div ref={wrap} className="relative flex-1">
        <div
          ref={copy}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words leading-[30px] text-transparent"
        >
          {parts.map((part, i) =>
            part.color ? (
              <span
                key={i}
                className="rounded-sm"
                style={{
                  background: tint(part.color, 0.22),
                  boxShadow: `inset 0 -2px 0 ${tint(part.color, 0.85)}`,
                }}
              >
                {part.text}
              </span>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
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
          onKeyUp={readSelection}
          placeholder="Write here… select words to mark them as a highlight"
          aria-label="Write a new entry"
          rows={10}
          style={{ background: "transparent" }}
          className="relative block w-full resize-none overflow-hidden whitespace-pre-wrap break-words leading-[30px] text-stone-100 outline-none placeholder:text-stone-600"
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
          withQuestion={false}
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

      <footer className="flex min-h-[30px] items-center gap-3">
        <span className="min-w-0 flex-1 font-mono text-[11px] text-stone-500">
          {error ? (
            <span className="text-rose-300">{error}</span>
          ) : (
            `${items.length ? `${items.length} highlight${items.length === 1 ? "" : "s"} · ` : ""}⌘S to save · anything left blank is filled in for you`
          )}
        </span>
        {draft && !saving && (
          <button
            type="button"
            onClick={discard}
            title="Your page is kept as you write, until you save it or discard it"
            className="shrink-0 font-mono text-[11px] text-stone-500 underline decoration-dotted hover:text-stone-300"
          >
            discard
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving || !content.trim()}
          className="shrink-0 rounded-md bg-ember px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-stone-950 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save to notebook"}
        </button>
      </footer>
    </article>
  )
}

// Endless scroll: the next pages load as you near the bottom.
// pages added each time you reach the bottom
const PAGE = 6

export function NotebookFeed({
  notes: all,
  filter,
  custom = [],
  category,
  q,
}: {
  // the entries to show (already filtered and searched), in order
  notes: NotebookNote[]
  filter: NotebookFilter
  category?: string
  q?: string
  // categories of your own (for giving uncategorized entries one)
  custom?: string[]
}) {
  const router = useRouter()
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
      <BlankPage onSaved={reload} custom={custom} />
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

  return (
    <div>
      {blank && <div className="mb-12">{blank}</div>}
      <ol className="space-y-12">
        {notes.slice(0, count).map((note) => (
          <li key={note.id}>
            <Page
              note={note}
              sorting={filter === "uncategorized"}
              custom={custom}
              onDeleted={() => setGone((g) => new Set(g).add(note.id))}
            />
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
