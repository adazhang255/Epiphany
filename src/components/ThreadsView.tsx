"use client"

import { CHIP, CHIP_ON } from "@/components/buttonStyles"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { EmbedMissingButton } from "@/components/EmbedMissingButton"
import { ThreadTitle } from "@/components/ThreadTitle"
import { HighlightKind } from "@/components/HighlightKind"
import { RemoveFromThreadButton } from "@/components/RemoveFromThreadButton"
import { AddHighlightToThread } from "@/components/AddHighlightToThread"
import { AddThoughtToThread } from "@/components/AddThoughtToThread"
import { RemoveThreadButton } from "@/components/RemoveThreadButton"
import {
  currentId,
  inHeldOrder,
  noteShownOrder,
  releaseOrder,
  useHeldOrder,
} from "@/components/threadOrder"
import { NewThread } from "@/components/NewThread"
import { ThreadTopics } from "@/components/ThreadTopics"
import { MergeThreadButton } from "@/components/MergeThreadButton"
import { useThreadTitles } from "@/components/threadTitles"
import type { ThreadRef } from "@/features/threads/membership"
import { KeepThreadInPlace } from "@/components/KeepThreadInPlace"
import { describeGap } from "@/features/notes/lib/time"
import { MATCH, type ThreadView } from "@/features/threads/match"
import { EntryTitle } from "@/components/EntryTitle"
import { foldText } from "@/features/search/words"
import { StarButton } from "@/components/StarButton"
import { ThreadCategory } from "@/components/ThreadCategory"
import { BackToTop } from "@/components/BackToTop"
import {
  categoryColor,
  categoryGlyph,
  highlightType,
} from "@/features/notes/lib/topics"
import { fromThread } from "@/components/BackLink"
import { PUBLIC_SITE } from "@/lib/site-mode"
import { grownThreads } from "@/features/threads/grew"
import { lastSeen, markSeen } from "@/components/threadsSeen"

// a thread's opening words, until it has a title
const opening = (thread: ThreadView) =>
  `${thread.members[0].quote.split(/\s+/).slice(0, 5).join(" ")}…`

// what the server needs to know to change a thread
const refOf = (thread: ThreadView): ThreadRef => ({
  id: thread.id,
  kind: thread.kind,
  questionId: thread.questionId,
  memberIds: thread.members.map((m) => m.id),
})

// "May 14, 2023"
function fullDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// The threads at each match level (the page builds all three); ?match picks
// one, in the browser.
export function ThreadsView({
  byLevel,
  missing,
  starred = [],
  categories = {},
  custom = [],
}: {
  byLevel: Record<keyof typeof MATCH, ThreadView[]>
  missing: number
  // ids of the threads you starred
  starred?: string[]
  // thread id → its category
  categories?: Record<string, string>
  // categories of your own already in use
  custom?: string[]
}) {
  const router = useRouter()
  const match = useSearchParams().get("match")
  const level =
    match && match in MATCH ? (match as keyof typeof MATCH) : "related"
  // threads you just removed, hidden while the page rebuilds
  const [hidden, setHidden] = useState<string[]>([])
  const [removeError, setRemoveError] = useState("")
  const all = byLevel[level].filter((t) => !hidden.includes(t.id))
  // what's new since you last looked: read once, then this visit counts as
  // looking (so the nav's count clears)
  const [since, setSince] = useState<number | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage, which the server can't
    setSince(lastSeen())
    markSeen()
  }, [])
  const grown = useMemo(
    () => (since ? grownThreads(all, since) : new Map<string, string[]>()),
    [all, since],
  )
  // finding a thread: by its title, its passages' words or their entries'
  // titles
  const [q, setQ] = useState("")
  // only the untitled ones: no title yet, from you or the model (the grey
  // ones). Taken when you tick it, so one that gets a title while you look
  // stays in the list (now white) rather than vanishing.
  const [untitledIds, setUntitledIds] = useState<Set<string> | null>(null)
  const onlyUntitled = untitledIds !== null
  const [onlyStarred, setOnlyStarred] = useState(false)
  const isStarred = (t: ThreadView) => starred.includes(t.id)
  // showing only threads of one category
  const [kind, setKind] = useState<string | null>(null)
  const kindOf = (t: ThreadView) =>
    categories[t.id] ? highlightType(categories[t.id]) : null
  const kinds = [...new Set(all.map(kindOf).filter((k): k is string => !!k))]
  const shared = useThreadTitles()
  const hasTitle = (t: ThreadView) => Boolean(t.title ?? shared.get(t.id))
  const setOnlyUntitled = (on: boolean) =>
    setUntitledIds(
      on ? new Set(all.filter((t) => !hasTitle(t)).map((t) => t.id)) : null,
    )
  // switching how-similar shows other threads: take the list again
  const [untitledLevel, setUntitledLevel] = useState(level)
  if (level !== untitledLevel) {
    setUntitledLevel(level)
    if (untitledIds) setOnlyUntitled(true)
  }
  const words = foldText(q).split(/\s+/).filter(Boolean)
  // starred threads on top; within each group, most recently continued
  // first (the order they come in; sort keeps it)
  const starredFirst = (a: ThreadView, b: ThreadView) =>
    Number(isStarred(b)) - Number(isStarred(a))
  // after a change on this page (renaming, taking a passage out), the
  // order you were looking at holds (see threadOrder)
  const heldOrder = useHeldOrder()
  // (held without the stars, so starring or unstarring still moves one)
  const byDate = inHeldOrder(all, heldOrder)
  const ordered = byDate.toSorted(starredFirst)
  useEffect(() => noteShownOrder(byDate.map((t) => t.id)))
  useEffect(() => () => releaseOrder(), [level])
  // (one you name while looking stays, even under the new id it gets)
  const untitledNow =
    untitledIds && new Set([...untitledIds].map((id) => currentId(id)))
  const threads = ordered.filter((t) => {
    if (untitledNow && !untitledNow.has(t.id)) return false
    if (onlyStarred && !isStarred(t)) return false
    if (kind && kindOf(t) !== kind) return false
    if (words.length === 0) return true
    const text = foldText(
      [
        t.title ?? shared.get(t.id) ?? "",
        ...t.members.flatMap((m) => [m.quote, m.noteTitle]),
      ].join(" "),
    )
    return words.every((w) => text.includes(w))
  })
  const filtering =
    words.length > 0 || onlyUntitled || onlyStarred || kind !== null

  return (
    <div>
      <div className="pt-12">
        <BackToTop />
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              Threads
            </p>
            <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
              Watch a thought evolve
            </h1>
            <p className="mt-3 max-w-2xl text-stone-400">
              Highlights from different days that circle the same idea, in the
              order you wrote them.
            </p>
          </div>
          <nav
            aria-label="How similar"
            className="inline-flex rounded-full border border-white/10 p-1 text-sm"
          >
            {(Object.keys(MATCH) as (keyof typeof MATCH)[]).map((key) => (
              <Link
                key={key}
                href={key === "related" ? "/threads" : `/threads?match=${key}`}
                className={`rounded-full px-3 py-1 ${key === level ? "bg-white/10 text-ink" : "text-stone-300 hover:text-ink"}`}
              >
                {MATCH[key].label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <NewThread />
          <EmbedMissingButton count={missing} />
        </div>
        {all.length > 0 && (
          <div className="mb-6 space-y-3">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a thread…"
              aria-label="Find a thread by its words"
              className="w-full max-w-xs rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:border-white/30"
            />
            {/* filters, as chips: "All" clears them; Starred and Untitled
                narrow the list, and so does one category */}
            <nav
              aria-label="Filter threads"
              className="relative flex flex-wrap items-center gap-2"
            >
              <span className="mr-1 font-mono text-[11px] uppercase tracking-widest text-stone-500">
                Show
              </span>
              <button
                type="button"
                aria-pressed={!onlyStarred && !onlyUntitled && kind === null}
                onClick={() => {
                  setOnlyStarred(false)
                  setOnlyUntitled(false)
                  setKind(null)
                }}
                className={
                  !onlyStarred && !onlyUntitled && kind === null
                    ? CHIP_ON
                    : CHIP
                }
              >
                All
                <span className="font-mono text-xs text-stone-500">
                  {all.length}
                </span>
              </button>
              {!PUBLIC_SITE && (
                <button
                  type="button"
                  aria-pressed={onlyStarred}
                  onClick={() => setOnlyStarred(!onlyStarred)}
                  className={onlyStarred ? CHIP_ON : CHIP}
                >
                  <span aria-hidden>★</span> Starred
                  <span className="font-mono text-xs text-stone-500">
                    {all.filter(isStarred).length}
                  </span>
                </button>
              )}
              {!PUBLIC_SITE && (
                <button
                  type="button"
                  aria-pressed={onlyUntitled}
                  onClick={() => setOnlyUntitled(!onlyUntitled)}
                  title="Threads with no title yet (the grey ones)"
                  className={onlyUntitled ? CHIP_ON : CHIP}
                >
                  Untitled
                  <span className="font-mono text-xs text-stone-500">
                    {all.filter((t) => !hasTitle(t)).length}
                  </span>
                </button>
              )}
              {kinds.length > 0 && (
                <span aria-hidden className="mx-1 h-4 w-px bg-white/10" />
              )}
              {kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(kind === k ? null : k)}
                  className={kind === k ? CHIP_ON : CHIP}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: categoryColor(k) }}
                  />
                  {`${categoryGlyph(k)} ${k}`}
                  <span className="font-mono text-xs text-stone-500">
                    {all.filter((t) => kindOf(t) === k).length}
                  </span>
                </button>
              ))}
              {filtering && (
                <span className="ml-1 text-xs text-stone-500">
                  {threads.length} of {all.length} shown
                </span>
              )}
              <ThreadTopics
                topics={threads.map((t) => ({
                  id: t.id,
                  title: t.title,
                  fallback: opening(t),
                  count: t.members.length,
                }))}
              />
            </nav>
          </div>
        )}
        {removeError && (
          <p role="alert" className="mb-6 text-sm text-rose-300">
            {removeError}
          </p>
        )}
        <KeepThreadInPlace
          version={threads
            .map((t) => `${t.id}:${t.members.map((m) => m.id).join("+")}`)
            .join(",")}
        />

        {threads.length === 0 && filtering ? (
          <p className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center text-stone-500">
            No thread matches.{" "}
            <button
              type="button"
              onClick={() => {
                setQ("")
                setOnlyUntitled(false)
                setOnlyStarred(false)
                setKind(null)
              }}
              className="underline hover:text-stone-300"
            >
              Show all
            </button>
          </p>
        ) : threads.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center text-stone-500">
            No threads yet. Threads appear once you’ve returned to an idea on a
            different day.
            {level !== "loose" && (
              <>
                {" "}
                <Link
                  href="/threads?match=loose"
                  className="underline hover:text-stone-300"
                >
                  Try a looser match
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <ol className="space-y-8">
            {threads.map((thread) => (
              <li
                key={thread.id}
                id={`thread-${thread.id}`}
                data-thread={thread.id}
                className="group/thread relative scroll-mt-32 rounded-2xl border border-white/[0.07] bg-panel p-6 pr-14 sm:scroll-mt-36 lg:scroll-mt-20"
              >
                {/* a favourite? top right (stays once starred) */}
                {!PUBLIC_SITE && (
                  <StarButton
                    key={`${thread.id}:${isStarred(thread)}`}
                    thread={refOf(thread)}
                    starred={isStarred(thread)}
                    onChange={() => router.refresh()}
                    className={`absolute right-6 top-6 text-xl ${
                      isStarred(thread)
                        ? ""
                        : "opacity-0 focus:opacity-100 group-hover/thread:opacity-100 pointer-coarse:opacity-100"
                    }`}
                  />
                )}
                <ThreadTitle
                  quoteIds={thread.members
                    .map((m) => m.id)
                    .filter((id) => !id.startsWith("q-"))}
                  known={thread.title}
                  named={thread.named}
                  thread={
                    thread.kind === "qa"
                      ? undefined
                      : {
                          id: thread.id,
                          kind: thread.kind,
                          memberIds: thread.members.map((m) => m.id),
                        }
                  }
                  fallback={opening(thread)}
                  shareAs={thread.id}
                />
                <div className="mb-5 mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <ThreadCategory
                      key={`${thread.id}:${categories[thread.id] ?? ""}`}
                      thread={refOf(thread)}
                      category={categories[thread.id] ?? null}
                      custom={custom}
                    />
                    <AddHighlightToThread thread={refOf(thread)} />
                    {thread.kind !== "qa" && (
                      <MergeThreadButton
                        thread={refOf(thread)}
                        title={thread.title}
                        fallback={opening(thread)}
                        others={all
                          .filter((o) => o.id !== thread.id && o.kind !== "qa")
                          .map((o) => ({
                            thread: refOf(o),
                            title: o.title,
                            fallback: opening(o),
                            passages: o.members.map((m) => ({
                              id: m.id,
                              quote: m.quote,
                              date: m.date,
                            })),
                          }))}
                      />
                    )}
                    <RemoveThreadButton
                      onHide={(hide, error) => {
                        setRemoveError(
                          error ? `Couldn’t remove a thread: ${error}` : "",
                        )
                        setHidden((ids) =>
                          hide
                            ? [...ids, thread.id]
                            : ids.filter((id) => id !== thread.id),
                        )
                      }}
                      thread={refOf(thread)}
                    />
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-stone-500">
                    {grown.has(thread.id) && (
                      <span className="rounded-full bg-ember/15 px-2 py-0.5 text-ember">
                        grew +{grown.get(thread.id)!.length}
                      </span>
                    )}
                    <span>
                      {thread.members.length}{" "}
                      {thread.members.length === 1 ? "moment" : "moments"}
                      {thread.members.length > 1 &&
                        ` · ${describeGap(thread.members[0].date, thread.members.at(-1)!.date) ?? "same day"}`}
                    </span>
                  </span>
                </div>

                <ol className="relative space-y-6 border-l border-ember/30 pl-6">
                  {thread.members.map((member, i) => {
                    const prev = thread.members[i - 1]
                    const gap = prev
                      ? describeGap(prev.date, member.date)
                      : null
                    const fresh = grown.get(thread.id)?.includes(member.id)
                    return (
                      <li key={member.id} className="group/member relative">
                        <span
                          aria-hidden
                          className={`absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-ember ${fresh ? "bg-ember shadow-[0_0_8px_var(--color-ember)]" : "bg-[#161617]"}`}
                        />
                        <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] uppercase tracking-widest text-stone-500">
                          {member.kind && (
                            <HighlightKind category={member.kind} />
                          )}
                          {fresh && <span className="text-ember">New ·</span>}
                          {fullDate(member.date)}
                          {i > 0 && gap && (
                            <span className="text-stone-600">
                              {" "}
                              · {gap} later
                            </span>
                          )}
                          <span className="ml-auto flex items-center gap-1 normal-case tracking-normal">
                            {/* the question a question's thread is about stays */}
                            {!(thread.kind === "qa" && i === 0) && (
                              <RemoveFromThreadButton
                                item={member.id}
                                thread={refOf(thread)}
                              />
                            )}
                          </span>
                        </p>
                        <Link
                          href={fromThread(
                            member.href ??
                              `/notes/${member.noteId}?h=${member.id}#h-${member.id}`,
                            thread.id,
                            match && match in MATCH ? match : null,
                          )}
                          className="mt-1.5 block font-serif text-lg leading-snug text-stone-200 hover:text-ink"
                        >
                          “{member.quote}”
                        </Link>
                        <p className="mt-1 text-xs text-stone-500">
                          from <EntryTitle title={member.noteTitle} />
                        </p>
                      </li>
                    )
                  })}
                  <AddThoughtToThread thread={refOf(thread)} />
                </ol>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
