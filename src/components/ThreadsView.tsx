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
  // titles; or only the ones you named
  const [q, setQ] = useState("")
  const [onlyNamed, setOnlyNamed] = useState(false)
  // only the ones you haven't named yet
  const [onlyUntitled, setOnlyUntitled] = useState(false)
  const [onlyStarred, setOnlyStarred] = useState(false)
  const isStarred = (t: ThreadView) => starred.includes(t.id)
  // showing only threads of one category
  const [kind, setKind] = useState<string | null>(null)
  const kindOf = (t: ThreadView) =>
    categories[t.id] ? highlightType(categories[t.id]) : null
  const kinds = [...new Set(all.map(kindOf).filter((k): k is string => !!k))]
  const shared = useThreadTitles()
  const words = foldText(q).split(/\s+/).filter(Boolean)
  const threads = all.filter((t) => {
    if (onlyNamed && !t.named) return false
    if (onlyUntitled && t.named) return false
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
    words.length > 0 ||
    onlyNamed ||
    onlyUntitled ||
    onlyStarred ||
    kind !== null

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
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a thread…"
              aria-label="Find a thread by its words"
              className="w-full max-w-xs rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:border-white/30"
            />
            <label className="flex items-center gap-2 text-sm text-stone-300">
              <input
                type="checkbox"
                checked={onlyNamed}
                onChange={(e) => {
                  setOnlyNamed(e.target.checked)
                  if (e.target.checked) setOnlyUntitled(false)
                }}
                className="accent-ember"
              />
              Only ones I named
            </label>
            {!PUBLIC_SITE && (
              <label
                className="flex items-center gap-2 text-sm text-stone-300"
                title="Threads you haven't named yet"
              >
                <input
                  type="checkbox"
                  checked={onlyUntitled}
                  onChange={(e) => {
                    setOnlyUntitled(e.target.checked)
                    if (e.target.checked) setOnlyNamed(false)
                  }}
                  className="accent-ember"
                />
                Untitled
                <span className="font-mono text-xs text-stone-500">
                  {all.filter((t) => !t.named).length}
                </span>
              </label>
            )}
            {!PUBLIC_SITE && (
              <label className="flex items-center gap-2 text-sm text-stone-300">
                <input
                  type="checkbox"
                  checked={onlyStarred}
                  onChange={(e) => setOnlyStarred(e.target.checked)}
                  className="accent-ember"
                />
                <span aria-hidden className="text-ember">
                  ★
                </span>{" "}
                Starred
                <span className="font-mono text-xs text-stone-500">
                  {all.filter(isStarred).length}
                </span>
              </label>
            )}
            {filtering && (
              <span className="text-xs text-stone-500">
                {threads.length} of {all.length}
              </span>
            )}
          </div>
        )}
        {kinds.length > 0 && (
          <nav
            aria-label="Show threads of one category"
            className="mb-4 flex flex-wrap items-center gap-2"
          >
            {[null, ...kinds].map((k) => (
              <button
                key={k ?? "all"}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={kind === k ? CHIP_ON : CHIP}
              >
                {k && (
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: categoryColor(k) }}
                  />
                )}
                {k ? `${categoryGlyph(k)} ${k}` : "All"}
                <span className="font-mono text-xs text-stone-500">
                  {k ? all.filter((t) => kindOf(t) === k).length : all.length}
                </span>
              </button>
            ))}
          </nav>
        )}
        <ThreadTopics
          topics={threads.map((t) => ({
            id: t.id,
            title: t.title,
            fallback: opening(t),
            count: t.members.length,
          }))}
        />
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
                setOnlyNamed(false)
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
