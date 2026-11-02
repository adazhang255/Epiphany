"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
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
import { KeepThreadInPlace } from "@/components/KeepThreadInPlace"
import { describeGap } from "@/features/notes/lib/time"
import { MATCH, type ThreadView } from "@/features/threads/match"
import { EntryTitle } from "@/components/EntryTitle"

// a thread's opening words, until it has a title
const opening = (thread: ThreadView) =>
  `${thread.members[0].quote.split(/\s+/).slice(0, 5).join(" ")}…`

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
}: {
  byLevel: Record<keyof typeof MATCH, ThreadView[]>
  missing: number
}) {
  const match = useSearchParams().get("match")
  const level =
    match && match in MATCH ? (match as keyof typeof MATCH) : "related"
  // threads you just removed, hidden while the page rebuilds
  const [hidden, setHidden] = useState<string[]>([])
  const [removeError, setRemoveError] = useState("")
  const threads = byLevel[level].filter((t) => !hidden.includes(t.id))

  return (
    <div>
      <div className="pt-12">
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
                className={`rounded-full px-3 py-1 ${key === level ? "bg-white/10 text-ink" : "text-stone-400 hover:text-stone-200"}`}
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

        {threads.length === 0 ? (
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
                className="scroll-mt-24 rounded-2xl border border-white/[0.07] bg-panel p-6 lg:scroll-mt-8"
              >
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
                    <AddHighlightToThread
                      thread={{
                        id: thread.id,
                        kind: thread.kind,
                        questionId: thread.questionId,
                        memberIds: thread.members.map((m) => m.id),
                      }}
                    />
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
                      thread={{
                        id: thread.id,
                        kind: thread.kind,
                        questionId: thread.questionId,
                        memberIds: thread.members.map((m) => m.id),
                      }}
                    />
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-stone-500">
                    {thread.members.length}{" "}
                    {thread.members.length === 1 ? "moment" : "moments"}
                    {thread.members.length > 1 &&
                      ` · ${describeGap(thread.members[0].date, thread.members.at(-1)!.date) ?? "same day"}`}
                  </span>
                </div>

                <ol className="relative space-y-6 border-l border-ember/30 pl-6">
                  {thread.members.map((member, i) => {
                    const prev = thread.members[i - 1]
                    const gap = prev
                      ? describeGap(prev.date, member.date)
                      : null
                    return (
                      <li key={member.id} className="group/member relative">
                        <span
                          aria-hidden
                          className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-ember bg-[#161617]"
                        />
                        <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] uppercase tracking-widest text-stone-500">
                          {member.kind && (
                            <HighlightKind category={member.kind} />
                          )}
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
                                thread={{
                                  id: thread.id,
                                  kind: thread.kind,
                                  questionId: thread.questionId,
                                  memberIds: thread.members.map((m) => m.id),
                                }}
                              />
                            )}
                          </span>
                        </p>
                        <Link
                          href={
                            member.href ??
                            `/notes/${member.noteId}?h=${member.id}#h-${member.id}`
                          }
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
                  <AddThoughtToThread
                    thread={{
                      id: thread.id,
                      kind: thread.kind,
                      questionId: thread.questionId,
                      memberIds: thread.members.map((m) => m.id),
                    }}
                  />
                </ol>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
