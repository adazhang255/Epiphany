"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { HighlightKind } from "@/components/HighlightKind"
import { RemoveHighlightButton } from "@/components/RemoveHighlightButton"
import { SavedToast } from "@/components/SavedToast"
import { ScrollToHighlight } from "@/components/ScrollToHighlight"
import { usePublicView } from "@/components/usePublicView"

// The entry page's address options, read in the browser (so the page itself
// can be built once per entry for the public site):
//   ?h=<highlight>  that highlight is marked and scrolled to
//   ?saved=1        just written: a "saved" note, highlights sweep in
//   ?edit=1         open straight into editing
export function useEntryParams() {
  const params = useSearchParams()
  return {
    activeId: params.get("h") ?? undefined,
    justSaved: params.get("saved") === "1",
    edit: params.get("edit") === "1",
  }
}

export function EntryArrival({
  highlights,
  pending,
}: {
  highlights: number
  pending: boolean
}) {
  const { activeId, justSaved } = useEntryParams()
  return (
    <>
      {activeId && <ScrollToHighlight id={activeId} />}
      {justSaved && <SavedToast highlights={highlights} pending={pending} />}
    </>
  )
}

type Quote = { id: string; quote: string; category: string; manual: boolean }

// A highlight that can't be marked in the text (it paraphrases it), shown
// above the text when it's the one asked for.
export function ActiveUnplaced({ unplaced }: { unplaced: Quote[] }) {
  const { activeId } = useEntryParams()
  const quote = unplaced.find((q) => q.id === activeId)
  if (!quote) return null
  return (
    <blockquote
      id={`h-${quote.id}`}
      className="mt-8 border-l-2 border-ember/60 pl-4 font-serif text-stone-300"
    >
      “{quote.quote}”
      <span className="mt-1 block font-sans text-xs text-stone-500">
        This older highlight paraphrases the entry, so it can’t be marked in the
        text below.
      </span>
    </blockquote>
  )
}

// The entry's highlights in the side column, the one asked for marked.
export function EntryHighlightList({
  noteId,
  quotes,
}: {
  noteId: string
  quotes: Quote[]
}) {
  const { activeId } = useEntryParams()
  return (
    <ul className="mt-3 space-y-2">
      {quotes.map((quote) => (
        <li key={quote.id} className="group/hl relative">
          <RemoveHighlightButton id={quote.id} className="right-1 top-1" />
          <Link
            href={`/notes/${noteId}?h=${quote.id}#h-${quote.id}`}
            scroll={false}
            className={`block rounded-lg border px-3 py-2 text-sm leading-snug transition ${
              quote.id === activeId
                ? "border-ember/50 bg-ember/10 text-ink"
                : "border-white/[0.07] text-stone-400 hover:text-stone-200"
            }`}
          >
            <span className="line-clamp-3 font-serif">“{quote.quote}”</span>
            <span className="mt-1 block">
              <HighlightKind category={quote.category} manual={quote.manual} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// How to mark passages (not on the public site, or its preview)
export function EntryTip() {
  if (usePublicView()) return null
  return (
    <p className="mt-6 text-xs text-stone-600">
      Tip: select any passage to mark it as Writing, Insight, Event, Emotion or
      Question. Click a highlight to change it.
    </p>
  )
}
