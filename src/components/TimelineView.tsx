"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { useTopicSearch, useToday } from "@/components/useTopicSearch"
import { PUBLIC_SITE } from "@/lib/site-mode"
import type { QuestionView } from "@/components/QuestionCard"
import { TimelineTabs } from "@/components/TimelineTabs"
import { ScrollToDay } from "@/components/ScrollToDay"
import { RemoveHighlightButton } from "@/components/RemoveHighlightButton"
import { AddToThreadButton } from "@/components/AddToThreadButton"
import { DraggableTimeline } from "@/components/DraggableTimeline"
import { TopicSearch } from "@/components/TopicSearch"
import { TimeRail, type RailMonth } from "@/components/TimeRail"
import { RemoveDuplicatesButton } from "@/components/RemoveDuplicatesButton"
import {
  dayKey,
  describeAgo,
  formatDay,
  timeOfDay,
  formatMonth,
  monthKey,
} from "@/features/notes/lib/time"
import {
  categoryColor,
  categoryGlyph,
  HIGHLIGHT_CATEGORIES,
  isBuiltinCategory,
  highlightType,
  entryCategories,
} from "@/features/notes/lib/topics"
import { PurposeBadges } from "@/components/PurposeBadges"
import { DeleteEntryButton } from "@/components/DeleteEntryButton"
import { ReanalyzeAllButton } from "@/components/ReanalyzeAllButton"
import { HighlightKind } from "@/components/HighlightKind"
import { OnThisDay } from "@/components/OnThisDay"
import { QuestionsSection } from "@/components/QuestionsSection"
import { EntryTitle } from "@/components/EntryTitle"

// What the timeline needs of each entry (the page loads it once; filters,
// order and search are applied here, in the browser).
export type TimelineNoteData = {
  id: string
  title: string
  content: string
  date: Date
  createdAt: Date
  ownCategory: string
  quotes: { id: string; quote: string; category: string; manual: boolean }[]
}

// `purposes`: the entry's category, from all its highlights (kept even when
// a highlight filter hides some of them)
type TimelineNote = TimelineNoteData & { purposes: string[] }

export type DuplicateGroups = React.ComponentProps<
  typeof RemoveDuplicatesButton
>["groups"]

type DayGroup = {
  key: string
  date: Date
  notes: TimelineNote[]
}

type MonthGroup = RailMonth & {
  entries: number
  days: DayGroup[]
}

const hasHighlights = (note: TimelineNote) => note.quotes.length > 0

// Highlights shown per note before the rest fold behind "…".
const VISIBLE_HIGHLIGHTS = 3

// Notes arrive sorted by date, so consecutive runs share a month and a day.
function groupByMonth(notes: TimelineNote[]) {
  const groups: MonthGroup[] = []
  for (const note of notes) {
    const key = monthKey(note.date)
    let month = groups.at(-1)
    if (!month || month.key !== key) {
      month = {
        key,
        label: formatMonth(note.date),
        year: note.date.getFullYear(),
        highlights: 0,
        entries: 0,
        days: [],
      }
      groups.push(month)
    }

    const day = month.days.at(-1)
    if (!day || day.key !== dayKey(note.date)) {
      month.days.push({
        key: dayKey(note.date),
        date: note.date,
        notes: [note],
      })
    } else {
      day.notes.push(note)
    }
    month.entries += 1
    month.highlights += note.quotes.length
  }
  return groups
}

function QuoteCard({
  noteId,
  quote,
}: {
  noteId: string
  quote: TimelineNote["quotes"][number]
}) {
  return (
    <li className="group/hl relative">
      <RemoveHighlightButton id={quote.id} className="right-2 top-2" />
      {/* sits in its own strip at the foot of the card, clear of the text */}
      <AddToThreadButton
        item={quote.id}
        quiet
        className="absolute bottom-2.5 right-3 z-10"
      />
      <Link
        href={`/notes/${noteId}?h=${quote.id}#h-${quote.id}`}
        className="group flex h-full flex-col rounded-xl border border-white/[0.07] bg-panel p-4 pb-11 transition hover:-translate-y-0.5 hover:border-ember/40 hover:bg-white/[0.04]"
      >
        <HighlightKind category={quote.category} manual={quote.manual} />
        <p className="mt-2 line-clamp-5 flex-1 font-serif text-[16px] leading-snug text-stone-200">
          “{quote.quote}”
        </p>
      </Link>
    </li>
  )
}

function NoteEntry({ note }: { note: TimelineNote }) {
  const time = timeOfDay(note.date, note.createdAt)
  const shown = note.quotes.slice(0, VISIBLE_HIGHLIGHTS)
  const hidden = note.quotes.slice(VISIBLE_HIGHLIGHTS)
  const grid = "grid gap-3 sm:grid-cols-3"

  return (
    <article id={`n-${note.id}`} className="group/entry">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <Link
          href={`/notes/${note.id}`}
          className="font-serif text-lg text-stone-200 hover:text-ink hover:underline"
        >
          <EntryTitle title={note.title} />
        </Link>
        {time && (
          <span className="font-mono text-[11px] text-stone-500">{time}</span>
        )}
        <PurposeBadges purposes={note.purposes} />
        <DeleteEntryButton
          noteId={note.id}
          title={note.title}
          className="ml-auto"
          idleClassName="opacity-0 focus:opacity-100 group-hover/entry:opacity-100"
        />
      </div>

      <ul className={`mt-3 ${grid}`}>
        {shown.map((quote) => (
          <QuoteCard key={quote.id} noteId={note.id} quote={quote} />
        ))}
      </ul>
      {hidden.length > 0 && (
        <details className="group/more mt-3">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-stone-400 transition hover:border-white/25 hover:text-stone-200 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-base leading-none">
              …
            </span>
            <span className="group-open/more:hidden">{hidden.length} more</span>
            <span className="hidden group-open/more:inline">Show fewer</span>
          </summary>
          <ul className={`mt-3 ${grid}`}>
            {hidden.map((quote) => (
              <QuoteCard key={quote.id} noteId={note.id} quote={quote} />
            ))}
          </ul>
        </details>
      )}
    </article>
  )
}

// A day's entries without highlights, folded behind "… N more notes"; open,
// one compact row each: title, category, tags.
function MoreNotes({ notes, more }: { notes: TimelineNote[]; more: boolean }) {
  return (
    <details className="group/notes">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-stone-400 transition hover:border-white/25 hover:text-stone-200 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-base leading-none">
          …
        </span>
        <span className="group-open/notes:hidden">
          {notes.length} {more ? "more " : ""}
          {notes.length === 1 ? "note" : "notes"}
        </span>
        <span className="hidden group-open/notes:inline">Hide notes</span>
      </summary>
      <ul className="mt-3 space-y-2.5">
        {notes.map((note) => (
          <li
            key={note.id}
            id={`n-${note.id}`}
            className="group/row flex flex-wrap items-center gap-x-3 gap-y-1.5"
          >
            <Link
              href={`/notes/${note.id}`}
              className="font-serif text-[15px] text-stone-300 hover:text-ink hover:underline"
            >
              <EntryTitle title={note.title} />
            </Link>
            <PurposeBadges purposes={note.purposes} />
            <DeleteEntryButton
              noteId={note.id}
              title={note.title}
              className="ml-auto"
              idleClassName="opacity-0 focus:opacity-100 group-hover/row:opacity-100"
            />
          </li>
        ))}
      </ul>
    </details>
  )
}

export function TimelineView({
  notes: loaded,
  duplicates,
  questions,
}: {
  notes: TimelineNoteData[]
  duplicates: DuplicateGroups
  questions: QuestionView[]
}) {
  const params = useSearchParams()
  const order = params.get("order") ?? undefined
  const type = params.get("type") ?? undefined
  const kind = params.get("kind") ?? undefined
  const query = params.get("q")?.trim() || undefined
  const oldestFirst = order === "oldest"
  const today = useToday()
  const questionCount = questions.filter((q) => !q.hidden).length
  const allNotes: TimelineNote[] = useMemo(() => {
    const list = loaded.map((note) => ({
      ...note,
      purposes: entryCategories(
        note.ownCategory,
        note.quotes.map((q) => q.category),
      ),
    }))
    return oldestFirst ? list.reverse() : list
  }, [loaded, oldestFirst])

  // Filter by highlight type: only those highlights, only entries that have
  // one. The built-in types, then any categories of your own in use.
  const types: string[] = [
    ...HIGHLIGHT_CATEGORIES,
    ...new Set(
      allNotes
        .flatMap((n) => n.quotes.map((q) => highlightType(q.category)))
        .filter((c) => !isBuiltinCategory(c)),
    ),
  ]
  const filter = types.find((c) => c.toLowerCase() === type)
  const typeCounts = Object.fromEntries(
    types.map((c) => [
      c,
      c === "Question"
        ? questionCount
        : allNotes.reduce(
            (n, note) =>
              n +
              note.quotes.filter((q) => highlightType(q.category) === c).length,
            0,
          ),
    ]),
  )
  const byType = filter
    ? allNotes
        .map((note) => ({
          ...note,
          quotes: note.quotes.filter(
            (q) => highlightType(q.category) === filter,
          ),
        }))
        .filter((note) => note.quotes.length > 0)
    : allNotes
  // Topic search: only the entries about it (by its words, or by meaning),
  // in timeline order; within each, the highlights that match by themselves,
  // or all of its highlights if none do.
  const found = useTopicSearch(query, loaded)
  const matched = new Set(found?.noteIds)
  const notes = found
    ? byType
        .filter((note) => matched.has(note.id))
        .map((note) => {
          const own = note.quotes.filter((q) => found.highlightIds.has(q.id))
          return own.length ? { ...note, quotes: own } : note
        })
    : byType
  const href = (next: {
    order?: boolean
    type?: string | null
    q?: string | null
  }) => {
    const params = new URLSearchParams()
    if (next.order ?? oldestFirst) params.set("order", "oldest")
    const t = next.type === undefined ? filter?.toLowerCase() : next.type
    if (t) params.set("type", t)
    const g = next.q === undefined ? query : next.q
    if (g) params.set("q", g)
    const q = params.toString()
    return q ? `/?${q}` : "/"
  }

  if (allNotes.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-32 text-center">
        <h1 className="font-serif text-4xl text-ink">
          Nothing on the timeline yet
        </h1>
        <p className="mt-4 text-stone-400">
          {PUBLIC_SITE
            ? "Nothing has been shared here yet."
            : "Write your first thought. Its highlights will appear here, in time."}
        </p>
        {!PUBLIC_SITE && (
          <Link
            href="/write"
            className="mt-8 inline-block rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-stone-900"
          >
            Start writing
          </Link>
        )}
      </div>
    )
  }

  const months = groupByMonth(notes)
  const totalHighlights = months.reduce((sum, m) => sum + m.highlights, 0)
  // dates from every entry, so a filter that matches nothing still works
  const dates = allNotes.map((n) => n.date.getTime())
  const newest = Math.max(...dates)
  const span = newest - Math.min(...dates) || 1
  const oldest = new Date(Math.min(...dates))

  return (
    <div>
      <TimelineTabs />
      <div className="pt-10">
        <RemoveDuplicatesButton groups={duplicates} />
        <header className="mb-10">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              Highlights
            </p>
            <Link
              href={href({ order: !oldestFirst })}
              aria-label={
                oldestFirst
                  ? "Oldest first. Switch to newest first"
                  : "Newest first. Switch to oldest first"
              }
              title={oldestFirst ? "Oldest first" : "Newest first"}
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1.5 text-stone-400 transition hover:border-white/25 hover:text-ink"
            >
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path
                  d="M5 2.5v11M2.5 11 5 13.5 7.5 11"
                  opacity={oldestFirst ? 0.4 : 1}
                />
                <path
                  d="M11 13.5v-11M8.5 5 11 2.5 13.5 5"
                  opacity={oldestFirst ? 1 : 0.4}
                />
              </svg>
              <span className="font-mono text-[10px] uppercase tracking-widest">
                {oldestFirst ? "Oldest" : "Newest"}
              </span>
            </Link>
          </div>
          <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
            How your thinking has moved
          </h1>
          <p className="mt-3 text-stone-400">
            {filter === "Question"
              ? `${questionCount} questions and wonderings`
              : `${totalHighlights} ${filter ? `${filter} ` : ""}highlights from ${notes.length} entries`}
            , since{" "}
            {oldest.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}{" "}
            ({describeAgo(oldest)}).
          </p>
          <div className="mt-4">
            <ReanalyzeAllButton noteIds={allNotes.map((n) => n.id)} />
          </div>
        </header>

        <ScrollToDay />
        {!filter && today && <OnThisDay notes={allNotes} today={today} />}

        <nav
          aria-label="Show highlights of one type"
          className="mb-10 flex flex-wrap items-center gap-2"
        >
          <Link
            href={href({ type: null })}
            aria-current={!filter ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              !filter
                ? "border-white/30 bg-white/10 text-ink"
                : "border-white/10 text-stone-400 hover:text-stone-200"
            }`}
          >
            All
          </Link>
          {types.map((c) => (
            <Link
              key={c}
              href={href({ type: c.toLowerCase() })}
              aria-current={filter === c ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
                filter === c
                  ? "border-white/30 bg-white/10 text-ink"
                  : "border-white/10 text-stone-400 hover:text-stone-200"
              }`}
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: categoryColor(c) }}
              />
              {categoryGlyph(c)} {c}
              <span className="font-mono text-xs text-stone-500">
                {typeCounts[c]}
              </span>
            </Link>
          ))}
        </nav>
        {filter !== "Question" && (
          <div className="-mt-6 mb-10">
            <TopicSearch
              action="/"
              active={query}
              keep={{
                order: oldestFirst ? "oldest" : undefined,
                type: filter?.toLowerCase(),
              }}
              clearHref={href({ q: null })}
            />
            {found?.loading && (
              <p className="mt-2 text-xs text-stone-500">Searching…</p>
            )}
            {found && !found.loading && (
              <p className="mt-2 text-xs text-stone-500">
                {notes.length} {notes.length === 1 ? "entry" : "entries"} about
                “{query}”
                {PUBLIC_SITE
                  ? ", by their words."
                  : ": ones using your words, and ones close in meaning."}
                {!found.byMeaning &&
                  !PUBLIC_SITE &&
                  " Matching by meaning is off (Ollama isn't running), so only exact words were matched."}
              </p>
            )}
          </div>
        )}

        {filter === "Question" ? (
          <QuestionsSection
            questions={questions}
            kind={kind}
            kindHref={(k) =>
              k
                ? `${href({ type: "question" })}&kind=${k}`
                : href({ type: "question" })
            }
          />
        ) : (
          <>
            {(filter || query) && notes.length === 0 && (
              <p className="mb-10 text-stone-500">
                {query
                  ? `Nothing about “${query}”${filter ? ` among ${filter} highlights` : ""}.`
                  : `No ${filter} highlights yet.${PUBLIC_SITE ? "" : " Select a passage on any entry to mark one."}`}
              </p>
            )}

            <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-12">
              <TimeRail
                months={months.map(({ key, label, year, highlights }) => ({
                  key,
                  label,
                  year,
                  highlights,
                }))}
              />

              <DraggableTimeline>
                {/* the spine: bright at the present, fading into the past */}
                <div
                  aria-hidden
                  className={`absolute bottom-0 left-[7px] top-2 w-px ${
                    oldestFirst
                      ? "bg-linear-to-b from-stone-800 via-stone-700 to-ember/60"
                      : "bg-linear-to-b from-ember/60 via-stone-700 to-stone-800"
                  }`}
                />

                {months.map((month) => (
                  <section
                    key={month.key}
                    id={`m-${month.key}`}
                    className="relative"
                  >
                    <h2 className="sticky top-[7.25rem] z-10 -ml-1 mb-6 flex items-baseline gap-3 bg-linear-to-b from-[#101011] via-[#101011]/95 to-transparent pb-4 pl-8 pt-3 lg:top-0">
                      <span className="font-serif text-3xl text-ink">
                        {month.label}
                      </span>
                      <span className="font-mono text-sm text-muted">
                        {month.year}
                      </span>
                      <span className="ml-auto font-mono text-xs text-stone-500">
                        {month.entries}{" "}
                        {month.entries === 1 ? "entry" : "entries"} ·{" "}
                        {month.highlights} highlights
                      </span>
                    </h2>

                    <ol className="space-y-2 pb-10">
                      {month.days.map((day) => {
                        const freshness =
                          1 - (newest - day.date.getTime()) / span
                        const label = `${formatDay(day.date)} ${day.date.getFullYear()}`
                        const full = day.notes.filter(hasHighlights)
                        const empty = day.notes.filter((n) => !hasHighlights(n))
                        return (
                          <li
                            key={day.key}
                            id={`d-${day.key}`}
                            data-day-label={label}
                          >
                            <div className="relative pl-10">
                              {/* click the dot to centre this day */}
                              <a
                                href={`#d-${day.key}`}
                                data-day-dot
                                aria-label={`Centre ${label} on the screen`}
                                title="Centre this day"
                                className="absolute left-0 top-[3px] h-[15px] w-[15px] rounded-full border-2 border-ember bg-[#101011] outline-none transition hover:scale-125 hover:bg-ember/30 focus-visible:ring-2 focus-visible:ring-ember/50"
                                style={{ opacity: 0.3 + freshness * 0.7 }}
                              />
                              <time
                                dateTime={day.date.toISOString()}
                                className="font-mono text-xs uppercase tracking-widest text-stone-400"
                              >
                                {formatDay(day.date)}
                                {day.notes.length > 1 && (
                                  <span className="text-stone-600">
                                    {" "}
                                    · {day.notes.length} entries
                                  </span>
                                )}
                              </time>

                              <div className="mt-3 space-y-8 pb-8">
                                {full.map((note) => (
                                  <NoteEntry key={note.id} note={note} />
                                ))}
                                {empty.length > 0 && (
                                  <MoreNotes
                                    notes={empty}
                                    more={full.length > 0}
                                  />
                                )}
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                ))}
              </DraggableTimeline>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
