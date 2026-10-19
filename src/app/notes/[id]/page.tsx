import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { GenerateHighlightsButton } from "@/components/GenerateHighlightsButton"
import { PublishToggle } from "@/components/PublishToggle"
import { NoteBody } from "@/components/NoteBody"
import { EditableEntry } from "@/components/EditableEntry"
import { PurposeBadges } from "@/components/PurposeBadges"
import {
  ActiveUnplaced,
  EntryArrival,
  EntryHighlightList,
  EntryTip,
} from "@/components/EntryParams"
import { findQuote, type QuoteRange } from "@/features/notes/lib/findQuote"
import {
  describeAgo,
  describeGap,
  formatLongDate,
} from "@/features/notes/lib/time"
import {
  entryCategories,
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
} from "@/features/notes/lib/topics"
import {
  getCustomCategories,
  getNoteWithNeighbors,
} from "@/features/notes/services/notes.service"
import { isAnalysisPending } from "@/features/notes/services/analysis-queue"
import { EntryTitle } from "@/components/EntryTitle"
import { ExportDocsButton } from "@/components/ExportDocsButton"

type Quote = { id: string; quote: string; category: string; manual: boolean }

// Split the note body into plain text and <mark>ed highlight segments.
function segment(content: string, quotes: Quote[]) {
  const located = quotes
    .map((quote) => ({ quote, range: findQuote(content, quote.quote) }))
    .filter(
      (item): item is { quote: Quote; range: QuoteRange } =>
        item.range !== null,
    )
    .sort((a, b) => a.range.start - b.range.start)

  const parts: ({ text: string } | { text: string; quote: Quote })[] = []
  const placed = new Set<string>()
  let cursor = 0
  for (const { quote, range } of located) {
    if (range.start < cursor) continue // overlaps an earlier highlight
    parts.push({ text: content.slice(cursor, range.start) })
    parts.push({ text: content.slice(range.start, range.end), quote })
    placed.add(quote.id)
    cursor = range.end
  }
  parts.push({ text: content.slice(cursor) })

  return { parts, unplaced: quotes.filter((q) => !placed.has(q.id)) }
}

// One entry. ?h, ?saved and ?edit are read in the browser (EntryParams), so
// the public site can build this page once per entry.
export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const pending = isAnalysisPending(id)
  const [result, custom] = await Promise.all([
    getNoteWithNeighbors(id),
    getCustomCategories(),
  ])
  if (!result) {
    notFound()
  }

  const { note, earlier, later } = result
  const { parts, unplaced } = segment(note.content, note.quotes)

  return (
    <Suspense>
      <div className="pt-10">
        <EntryArrival highlights={note.quotes.length} pending={pending} />

        <Link
          href={`/#n-${note.id}`}
          className="font-mono text-xs uppercase tracking-widest text-stone-500 hover:text-stone-200"
        >
          ← Back to timeline
        </Link>

        <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_260px]">
          <article>
            <EditableEntry
              note={{
                id: note.id,
                title: note.title,
                content: note.content,
                date: note.date.toISOString(),
                ownCategory: note.ownCategory,
                categories: entryCategories(
                  note.ownCategory,
                  note.quotes.map((q) => q.category),
                ),
                sentiment: note.sentiment,
                highlights: note.quotes.map((q) => ({
                  id: q.id,
                  quote: q.quote,
                  category: q.category,
                  manual: q.manual,
                })),
              }}
              custom={custom}
            >
              <p className="pr-32 font-mono text-xs uppercase tracking-[0.2em] text-muted">
                {formatLongDate(note.date)} · {describeAgo(note.date)}
              </p>
              <h1 className="mt-3 font-serif text-4xl leading-tight text-ink sm:text-5xl">
                <EntryTitle title={note.title} />
              </h1>
              <dl className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <dt className="w-16 font-mono text-[10px] uppercase tracking-widest text-stone-600">
                    Category
                  </dt>
                  <dd>
                    {entryCategories(
                      note.ownCategory,
                      note.quotes.map((q) => q.category),
                    ).length > 0 ? (
                      <PurposeBadges
                        purposes={entryCategories(
                          note.ownCategory,
                          note.quotes.map((q) => q.category),
                        )}
                      />
                    ) : (
                      <span className="text-sm text-stone-500">
                        None yet. It comes from the entry&apos;s highlights.
                      </span>
                    )}
                  </dd>
                </div>
                {note.sentiment !== null && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <dt className="w-16 font-mono text-[10px] uppercase tracking-widest text-stone-600">
                      Tone
                    </dt>
                    <dd className="flex items-center gap-1.5 text-sm text-stone-300">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ background: SENTIMENT_COLORS[note.sentiment] }}
                      />
                      {SENTIMENT_LABELS[note.sentiment]}
                    </dd>
                  </div>
                )}
              </dl>

              <ActiveUnplaced unplaced={unplaced} />

              <NoteBody
                noteId={note.id}
                custom={custom}
                parts={parts.map((p) =>
                  "quote" in p
                    ? {
                        text: p.text,
                        quote: {
                          id: p.quote.id,
                          category: p.quote.category,
                          manual: p.quote.manual,
                        },
                      }
                    : { text: p.text },
                )}
              />
              <EntryTip />
            </EditableEntry>
          </article>

          <aside className="space-y-10 lg:sticky lg:top-8 lg:self-start">
            <PublishToggle noteId={note.id} published={note.published} />
            <ExportDocsButton ids={[note.id]} />
            <section>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                Highlights
              </h2>
              {note.quotes.length > 0 ? (
                <EntryHighlightList
                  noteId={note.id}
                  quotes={note.quotes.map((q) => ({
                    id: q.id,
                    quote: q.quote,
                    category: q.category,
                    manual: q.manual,
                  }))}
                />
              ) : (
                <p className="mt-3 text-sm text-stone-500">
                  {pending ? "Being found in the background…" : "None yet."}
                </p>
              )}
              <div className="mt-4">
                <GenerateHighlightsButton
                  noteId={note.id}
                  hasHighlights={note.quotes.length > 0}
                />
              </div>
            </section>

            <section>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                Across time
              </h2>
              <div className="mt-3 space-y-2">
                {earlier && (
                  <Link
                    href={`/notes/${earlier.id}`}
                    className="block rounded-lg border border-white/[0.07] px-3 py-2 hover:bg-white/[0.03]"
                  >
                    <span className="block font-mono text-[10px] uppercase tracking-widest text-stone-500">
                      ← {describeGap(earlier.date, note.date) ?? "same day"}
                      {describeGap(earlier.date, note.date) ? " before" : ""}
                    </span>
                    <span className="text-sm text-stone-300">
                      <EntryTitle title={earlier.title} />
                    </span>
                  </Link>
                )}
                {later && (
                  <Link
                    href={`/notes/${later.id}`}
                    className="block rounded-lg border border-white/[0.07] px-3 py-2 hover:bg-white/[0.03]"
                  >
                    <span className="block font-mono text-[10px] uppercase tracking-widest text-stone-500">
                      {describeGap(note.date, later.date) ?? "same day"}
                      {describeGap(note.date, later.date) ? " after" : ""} →
                    </span>
                    <span className="text-sm text-stone-300">
                      <EntryTitle title={later.title} />
                    </span>
                  </Link>
                )}
                {!earlier && !later && (
                  <p className="text-sm text-stone-500">
                    This is your only entry so far.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </Suspense>
  )
}
