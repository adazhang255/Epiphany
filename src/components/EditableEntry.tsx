"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { plainTitle } from "@/features/notes/lib/titles"
import {
  confirmDiscard,
  entryDraftKey,
  loadDraft,
  useDraftAutosave,
  useUnsavedWarning,
} from "@/components/useDraft"
import { CategoryPicker } from "@/components/CategoryPicker"
import { OnTop } from "@/components/OnTop"
import { DeleteEntryButton } from "@/components/DeleteEntryButton"
import { HighlightKind } from "@/components/HighlightKind"
import { useEntryParams } from "@/components/EntryParams"
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
  splitList,
} from "@/features/notes/lib/topics"
import { TrashIcon } from "@/components/TrashIcon"

const isoDay = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

type Note = {
  id: string
  title: string
  content: string
  date: string // ISO
  ownCategory: string // chosen by you, comma-separated; "" = from highlights
  categories: string[] // what it shows now: yours, or from its highlights
  highlights: { id: string; quote: string; category: string; manual: boolean }[]
  sentiment: number | null // overall tone, -2 … 2; null = not scored yet
}

// Where each highlight sits in the saved text, to follow as you edit.
function locate(text: string, highlights: Note["highlights"]) {
  const ranges: Record<string, Range> = {}
  for (const h of highlights) {
    const range = findQuote(text, h.quote)
    if (range) ranges[h.id] = range
  }
  return ranges
}

// An entry page's text, with an Edit button that swaps it for the same
// ruled paper as the Write page, plus the entry's category (yours
// to set, or left to its highlights) and a way to mark highlights. Saving
// re-reads changed text: questions at once, highlights in the background.
// What the form starts from: the entry as saved, with every tag it has
// (yours and the AI's) laid out to edit.
// (a temporary title is edited as plain text; saved unchanged, it stays
// temporary)
const draftOf = (note: Note) => ({
  title: plainTitle(note.title),
  content: note.content,
  date: isoDay(note.date),
  ownCategory: splitList(note.ownCategory),
})

// unsaved changes to an entry, kept in the browser until saved or discarded
type EntryDraft = {
  base: string // the entry's text when you started editing
  draft: ReturnType<typeof draftOf>
  ranges: ReturnType<typeof locate>
  added: { key: string; category: string }[]
  types: Record<string, string>
  removedIds: string[]
  categoryTouched: boolean
  tone: number | null
  toneTouched: boolean
}

export function EditableEntry({
  note,
  custom,
  children,
}: {
  note: Note
  // categories of your own, offered alongside the built-in ones
  custom: string[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const readOnly = usePublicView()
  const box = useRef<HTMLTextAreaElement>(null)
  // ?edit=1 opens straight into editing (e.g. arriving from the notebook)
  const { edit } = useEntryParams()
  const [editing, setEditing] = useState(edit)
  const [draft, setDraft] = useState(() => draftOf(note))
  // where each highlight is in the text being edited (moves with your edits)
  const [ranges, setRanges] = useState(() =>
    locate(note.content, note.highlights),
  )
  // the category is only saved once you change it, so one that comes from
  // the highlights doesn't quietly become fixed
  const [categoryTouched, setCategoryTouched] = useState(false)
  // the entry's overall tone; only sent if you change it
  const [tone, setTone] = useState<number | null>(note.sentiment)
  const [toneTouched, setToneTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  // the text selected in the box, to mark as a highlight
  // the selection, and the end of it the cursor is at
  const [selRange, setSelRange] = useState<(Range & { caret: number }) | null>(
    null,
  )
  // changes to the highlights themselves, applied when you save
  const [types, setTypes] = useState<Record<string, string>>({})
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [typeOpen, setTypeOpen] = useState<string | null>(null)
  const [marking, setMarking] = useState("")
  // highlights you mark while editing (kept with the draft until you save)
  const [added, setAdded] = useState<{ key: string; category: string }[]>([])
  const nextKey = useRef(0)
  // where the cursor is, to offer a type change when it's inside a highlight
  const [caret, setCaret] = useState<number | null>(null)
  // the type picker floats just under the selection (or the highlight you
  // clicked into); typing hides it
  const wrap = useRef<HTMLDivElement>(null)
  const copy = useRef<HTMLDivElement>(null)
  const [clickedInto, setClickedInto] = useState(false)
  const [anchor, setAnchor] = useState<PickerSpot | null>(null)

  // unsaved changes from before (you left the page while editing), brought
  // back when you edit again; arriving with ?edit=1 picks them up at once
  const draftKey = entryDraftKey(note.id)
  const [ready, setReady] = useState(false)
  const [kept, setKept] = useState<EntryDraft | null>(null)
  // the saved entry changed after these edits began (in another tab)
  const [stale, setStale] = useState(false)
  function apply(d: EntryDraft) {
    setDraft(d.draft)
    setRanges(d.ranges)
    setAdded(d.added)
    setTypes(d.types)
    setRemovedIds(d.removedIds)
    setCategoryTouched(d.categoryTouched)
    setTone(d.tone)
    setToneTouched(d.toneTouched)
    setStale(d.base !== note.content)
    nextKey.current =
      Math.max(-1, ...d.added.map((a) => Number(a.key.slice(2)) || 0)) + 1
  }
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reads browser storage, which the server can't */
    const d = loadDraft<EntryDraft>(draftKey)
    if (d && edit) apply(d)
    else setKept(d)
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    // only on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function start() {
    const d = loadDraft<EntryDraft>(draftKey)
    setKept(null)
    setTypeOpen(null)
    setError("")
    setMarking("")
    setCaret(null)
    setEditing(true)
    if (d) return apply(d)
    setStale(false)
    setDraft(draftOf(note))
    setRanges(locate(note.content, note.highlights))
    setTypes({})
    setRemovedIds([])
    setTypeOpen(null)
    setCategoryTouched(false)
    setTone(note.sentiment)
    setToneTouched(false)
    setError("")
    setMarking("")
    setAdded([])
    setCaret(null)
    setEditing(true)
  }

  // Cancel or esc: changes go only if you say so
  function cancel() {
    if (unsaved && !confirmDiscard("your changes to this entry")) return
    clearDraft()
    stop()
  }

  // leaving edit mode also drops ?edit=1 from the address
  function stop() {
    setEditing(false)
    router.replace(`/notes/${note.id}`, { scroll: false })
  }

  async function save() {
    if (!draft.content.trim()) {
      setError("An entry needs some text.")
      return
    }
    setSaving(true)
    setError("")
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        ownCategory: categoryTouched ? draft.ownCategory : undefined,
        sentiment: toneTouched ? tone : undefined,
        // highlights whose words you changed, with their new words; ones
        // whose words you deleted entirely
        highlights: edited.map((h) => ({
          id: h.id,
          quote: nowText(h.id) ?? h.quote,
          category: typeOf(h),
        })),
        removedHighlights: removed.map((h) => h.id),
        addedHighlights: added
          .filter((a) => ranges[a.key])
          .map((a) => ({
            quote: draft.content.slice(ranges[a.key].start, ranges[a.key].end),
            category: a.category,
          })),
      }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "Couldn't save. Is the server running?")
      return
    }
    clearDraft()
    stop()
    router.refresh()
  }

  // what the picker shows as chosen: your edits, else the entry's category
  // as it is now (yours, or the one from its highlights)
  const shownCategories = categoryTouched
    ? draft.ownCategory
    : draft.ownCategory.length
      ? draft.ownCategory
      : note.categories

  // where the shown category comes from
  const categoryNote = categoryTouched
    ? draft.ownCategory.length
      ? "Your choice for this entry."
      : "None chosen: it will take the category of most of its highlights."
    : note.ownCategory
      ? "Your choice for this entry."
      : note.categories.length
        ? "From its highlights. Pick to change it."
        : "None yet: no highlights to take one from. Pick one to give it a category."

  function toggleCategory(name: string) {
    const base = shownCategories
    setDraft((d) => ({
      ...d,
      ownCategory: base.includes(name)
        ? base.filter((c) => c !== name)
        : [...base, name].slice(-3),
    }))
    setCategoryTouched(true)
  }

  function readSelection() {
    const el = box.current
    if (!el) return
    setCaret(el.selectionStart)
    setSelRange(
      el.selectionEnd > el.selectionStart
        ? {
            start: el.selectionStart,
            end: el.selectionEnd,
            caret: caretEnd(el),
          }
        : null,
    )
  }

  // a text box's selection isn't always reported through its own events;
  // the page-wide selectionchange always fires
  useEffect(() => {
    if (!editing) return
    const onChange = () => {
      if (document.activeElement === box.current) readSelection()
    }
    document.addEventListener("selectionchange", onChange)
    return () => document.removeEventListener("selectionchange", onChange)
  }, [editing])

  // every highlight showing now: the entry's (minus removed), then new ones
  const items = [
    ...note.highlights
      .filter((h) => !removedIds.includes(h.id))
      .map((h) => ({ id: h.id, category: types[h.id] ?? h.category })),
    ...added.map((a) => ({ id: a.key, category: a.category })),
  ].filter((h) => ranges[h.id])
  const parts = markUp(draft.content, items, ranges)
  // the highlight the cursor is in (when nothing is selected)
  const here =
    !selRange && caret !== null
      ? items.find(
          (h) => ranges[h.id].start <= caret && caret <= ranges[h.id].end,
        )
      : undefined
  // each highlight's words now, where your edits changed them
  const original = locate(note.content, note.highlights)
  const nowText = (id: string) =>
    ranges[id] ? draft.content.slice(ranges[id].start, ranges[id].end) : null
  const wasText = (id: string) =>
    original[id]
      ? note.content.slice(original[id].start, original[id].end)
      : null
  const typeOf = (h: Note["highlights"][number]) => types[h.id] ?? h.category
  const removed = note.highlights.filter(
    (h) => removedIds.includes(h.id) || (original[h.id] && !ranges[h.id]),
  )
  const edited = note.highlights.filter(
    (h) =>
      !removed.includes(h) &&
      ((ranges[h.id] && nowText(h.id) !== wasText(h.id)) ||
        (types[h.id] !== undefined && types[h.id] !== h.category)),
  )

  // anything changed that saving would keep
  const unsaved =
    editing &&
    (JSON.stringify(draft) !== JSON.stringify(draftOf(note)) ||
      removed.length > 0 ||
      edited.length > 0 ||
      added.length > 0 ||
      (toneTouched && tone !== note.sentiment))
  const keep = useMemo<EntryDraft | null>(
    () =>
      unsaved
        ? {
            base: note.content,
            draft,
            ranges,
            added,
            types,
            removedIds,
            categoryTouched,
            tone,
            toneTouched,
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      unsaved,
      draft,
      ranges,
      added,
      types,
      removedIds,
      categoryTouched,
      tone,
      toneTouched,
    ],
  )
  // only while editing: a draft kept from before stays until you edit again
  const clearDraft = useDraftAutosave(draftKey, keep, ready && editing)
  useUnsavedWarning(unsaved && !saving)

  // the box grows with its text (no inner scrolling), so the tinted copy
  // behind it always lines up
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [draft.content, editing])

  // where the floating picker goes: under the cursor at the end of the
  // selection, or the end of the highlight you clicked into
  const anchorAt = selRange
    ? selRange.caret
    : clickedInto && here
      ? ranges[here.id].end
      : null
  useLayoutEffect(() => {
    const host = wrap.current
    const model = copy.current
    if (anchorAt === null || !host || !model) {
      setAnchor(null)
      return
    }
    setAnchor(pickerSpot(host, model, draft.content, anchorAt))
  }, [anchorAt, draft.content])

  // Mark the selected words as a highlight of this type. Highlights they
  // overlap are replaced. Saved with everything else when you press Save.
  function markSelection(category: string) {
    if (!selRange) return
    const sel = snapToWords(draft.content, selRange)
    const hit = items.filter(
      (h) => ranges[h.id].start < sel.end && sel.start < ranges[h.id].end,
    )
    const hitIds = new Set(hit.map((h) => h.id))
    const key = `new-${nextKey.current++}`
    setRemovedIds((ids) => [
      ...ids,
      ...note.highlights.filter((h) => hitIds.has(h.id)).map((h) => h.id),
    ])
    setAdded((list) => [
      ...list.filter((a) => !hitIds.has(a.key)),
      { key, category },
    ])
    setRanges((r) => ({ ...r, [key]: sel }))
    setMarking(
      `Marked as ${category}${hit.length ? `, replacing ${hit.length === 1 ? "the highlight" : `${hit.length} highlights`} there` : ""}. Saved when you press Save.`,
    )
    setSelRange(null)
  }

  // Take a highlight off (one marked in this edit simply goes; a saved one
  // goes when you press Save). It leaves the list below at once.
  function removeHighlight(id: string) {
    if (added.some((a) => a.key === id)) {
      setAdded((list) => list.filter((a) => a.key !== id))
      setRanges((r) => {
        const next = { ...r }
        delete next[id]
        return next
      })
    } else setRemovedIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
    setTypeOpen(null)
    setCaret(null)
    setMarking("Highlight removed. Saved when you press Save.")
  }

  // Switch the type of the highlight the cursor is in.
  function retype(id: string, category: string) {
    if (added.some((a) => a.key === id))
      setAdded((list) =>
        list.map((a) => (a.key === id ? { ...a, category } : a)),
      )
    else setTypes((t) => ({ ...t, [id]: category }))
    setMarking(`Changed to ${category}. Saved when you press Save.`)
  }

  // the public site only shows the entry
  if (readOnly) return <>{children}</>
  if (!editing) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={start}
          title={kept ? "You have unsaved changes to this entry" : undefined}
          className="absolute right-0 top-0 rounded-full bg-ember px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-widest text-stone-950 shadow-lg shadow-ember/10 transition hover:bg-[#f0d08f]"
        >
          {kept ? "✎ Continue editing (unsaved)" : "✎ Edit entry"}
        </button>
        {children}
      </div>
    )
  }

  const input =
    "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-stone-100 outline-none focus:border-white/30"
  const label =
    "w-20 shrink-0 pt-1.5 font-mono text-[10px] uppercase tracking-widest text-stone-500"

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      onKeyDown={(e) => {
        // (not when esc closed something inside, like a picker)
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault()
          cancel()
        }
        if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          save()
        }
      }}
      className="space-y-5"
    >
      {/* Save sits up by the title, where you start and finish */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">
          Editing
        </p>
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={cancel}
            className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-stone-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-ink px-5 py-1.5 text-sm font-medium text-stone-900 hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </span>
        {error && (
          <p role="alert" className="w-full text-right text-xs text-rose-300">
            {error}
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Title"
          aria-label="Title"
          className={`${input} font-serif text-2xl`}
        />
        <input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          aria-label="Date"
          className={`${input} [color-scheme:dark]`}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          <span className={label}>Category</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <CategoryPicker
              custom={custom}
              selected={shownCategories}
              withQuestion={false}
              onPick={toggleCategory}
            />
            <p className="text-xs text-stone-500">
              {categoryNote}{" "}
              {draft.ownCategory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft({ ...draft, ownCategory: [] })
                    setCategoryTouched(true)
                  }}
                  className="underline hover:text-stone-300"
                >
                  Use its highlights instead
                </button>
              )}
            </p>
          </div>
        </div>
        {/* the entry's overall tone (not any one highlight's) */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          <span className={label}>Tone</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div
              role="radiogroup"
              aria-label="Overall tone of the entry"
              className="flex flex-wrap items-center gap-1"
            >
              {[-2, -1, 0, 1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={tone === n}
                  onClick={() => {
                    setTone(n)
                    setToneTouched(true)
                  }}
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
            <p className="text-xs text-stone-500">
              {tone === null
                ? "Not scored yet: the model scores it in the background, or pick one."
                : toneTouched
                  ? "Your choice for the whole entry. "
                  : "The entry's overall tone. Pick another to change it. "}
              {tone !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setTone(null)
                    setToneTouched(true)
                  }}
                  className="underline hover:text-stone-300"
                >
                  Clear (let the model score it)
                </button>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* the text box sits on a copy of the text with the highlights
          tinted in, laid out identically, so they show while you edit */}
      <div ref={wrap} className="relative">
        <div
          ref={copy}
          aria-hidden
          className="notebook pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-transparent py-3 pr-4 font-serif text-[18px] text-transparent"
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
          value={draft.content}
          onChange={(e) => {
            const next = e.target.value
            setRanges((r) => follow(r, draft.content, next))
            setDraft({ ...draft, content: next })
          }}
          onSelect={readSelection}
          onKeyDown={(e) => {
            // typing (not just moving around) puts the picker away
            if (
              e.key.length === 1 ||
              e.key === "Backspace" ||
              e.key === "Delete"
            )
              setClickedInto(false)
          }}
          onKeyUp={readSelection}
          onMouseUp={() => {
            readSelection()
            setClickedInto(true)
          }}
          aria-label="Entry text"
          autoFocus
          rows={12}
          style={{ background: "transparent" }}
          className="notebook relative block w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-white/10 py-3 pr-4 font-serif text-[18px] text-stone-100 outline-none focus:border-white/30"
        />

        {anchor && (selRange || here) && (
          <OnTop>
            <div
              role="dialog"
              aria-label={
                selRange ? "Mark the selection" : "Change this highlight"
              }
              className="absolute z-[70] w-max max-w-[min(24rem,90vw)] font-sans rounded-xl border border-white/15 bg-stone-900/95 p-2 shadow-xl backdrop-blur"
              style={spotStyle(anchor)}
            >
              <p className="px-1 pb-1.5 text-[11px] text-stone-400">
                {selRange
                  ? "Mark as"
                  : `${here!.category} highlight · change to`}
              </p>
              {selRange ? (
                <CategoryPicker custom={custom} onPick={markSelection} />
              ) : (
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <CategoryPicker
                      custom={custom}
                      selected={[here!.category]}
                      allowNew={false}
                      onPick={(c) => retype(here!.id, c)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHighlight(here!.id)}
                    aria-label="Remove highlight"
                    title="Remove this highlight (the text stays)"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-stone-400 transition hover:border-rose-400/50 hover:bg-rose-400/10 hover:text-rose-300"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
          </OnTop>
        )}
      </div>
      <p className="-mt-3 text-xs text-stone-500" aria-live="polite">
        {marking ||
          "Select words to mark them as a highlight, or click inside a highlight to change its type."}
      </p>

      {note.highlights.length + added.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-stone-500">
            Highlights in this entry · {items.length}
          </p>
          <ul className="space-y-1.5">
            {note.highlights.map((h) => {
              // removed ones leave the list (see the line under it to undo)
              if (removed.includes(h)) return null
              const words = nowText(h.id) ?? h.quote
              return (
                <li
                  key={h.id}
                  className="rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {/* click the type to change it */}
                    <button
                      type="button"
                      onClick={() =>
                        setTypeOpen((open) => (open === h.id ? null : h.id))
                      }
                      title="Change its type"
                      className="rounded px-1 hover:bg-white/10"
                    >
                      <HighlightKind category={typeOf(h)} manual={h.manual} />
                    </button>
                    <span className="min-w-0 flex-1 font-serif text-stone-300">
                      “{words.length > 120 ? `${words.slice(0, 120)}…` : words}”
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
                      {edited.includes(h) && (
                        <span className="text-ember">edited</span>
                      )}
                      <button
                        type="button"
                        disabled={!selRange}
                        onClick={() => {
                          if (!selRange) return
                          setRanges((r) => ({
                            ...r,
                            [h.id]: snapToWords(draft.content, selRange),
                          }))
                        }}
                        title={
                          selRange
                            ? "Make this highlight cover the text you've selected"
                            : "Select text in the box above first"
                        }
                        className="text-stone-400 underline hover:text-stone-200 disabled:no-underline disabled:opacity-40"
                      >
                        Use selection
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHighlight(h.id)}
                        aria-label="Remove this highlight"
                        title="Remove this highlight (the text stays)"
                        className="text-stone-500 hover:text-rose-300"
                      >
                        <TrashIcon size={13} />
                      </button>
                    </span>
                  </div>
                  {typeOpen === h.id && (
                    <div className="mt-2 pl-1">
                      <CategoryPicker
                        custom={custom}
                        selected={[typeOf(h)]}
                        allowNew={false}
                        onPick={(c) => {
                          setTypes((t) => ({ ...t, [h.id]: c }))
                          setTypeOpen(null)
                        }}
                      />
                    </div>
                  )}
                </li>
              )
            })}
            {added
              .filter((a) => ranges[a.key])
              .map((a) => {
                const words = draft.content.slice(
                  ranges[a.key].start,
                  ranges[a.key].end,
                )
                return (
                  <li
                    key={a.key}
                    className="flex flex-wrap items-baseline gap-x-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]"
                  >
                    <HighlightKind category={a.category} manual />
                    <span className="min-w-0 flex-1 font-serif text-stone-300">
                      “{words.length > 120 ? `${words.slice(0, 120)}…` : words}”
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ember">
                      new
                    </span>
                    <button
                      type="button"
                      onClick={() => removeHighlight(a.key)}
                      aria-label="Remove this highlight"
                      title="Remove this highlight (the text stays)"
                      className="text-stone-500 hover:text-rose-300"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </li>
                )
              })}
          </ul>
          {removed.length > 0 && (
            <p className="mt-2 px-2 text-xs text-stone-500">
              {removed.length}{" "}
              {removed.length === 1 ? "highlight" : "highlights"} removed on
              save.{" "}
              {removedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRemovedIds([])}
                  className="underline hover:text-stone-300"
                >
                  Undo
                </button>
              )}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-stone-500" aria-live="polite">
          {error ? (
            <span className="text-rose-300">{error}</span>
          ) : (
            `${stale ? "Unsaved changes brought back; the saved entry has changed since, and saving replaces it. " : ""}⌘S save · esc cancel · changes are kept until you save. Highlights follow your edits; ones you change are kept as yours.`
          )}
        </p>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <DeleteEntryButton
            noteId={note.id}
            title={note.title}
            redirectTo="/"
          />
        </span>
      </div>
    </form>
  )
}
