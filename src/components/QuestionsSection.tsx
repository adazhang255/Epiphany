"use client"

import Link from "next/link"
import { FindAnswersButton } from "@/components/FindAnswersButton"
import { QuestionCard, type QuestionView } from "@/components/QuestionCard"

const KINDS = [
  { id: "all", label: "All" },
  { id: "question", label: "? Questions" },
  { id: "wondering", label: "~ Wonderings" },
  { id: "hidden", label: "Not questions" },
] as const

// Every question and wondering from every entry, newest first, with a
// Questions / Wonderings filter. Shown on the timeline under "? Question".
// Questions stay open; answers found in later entries hang below them.
// (The questions are loaded by the page: loadQuestionViews.)
export function QuestionsSection({
  questions,
  kind,
  kindHref,
}: {
  questions: QuestionView[]
  kind?: string
  kindHref: (kind: string | null) => string
}) {
  const filter =
    kind === "question" || kind === "wondering" || kind === "hidden"
      ? kind
      : "all"

  // ones you marked "not a question" only show under their own filter
  const shown = questions.filter((q) =>
    filter === "hidden"
      ? q.hidden
      : !q.hidden && (filter === "all" || q.kind === filter),
  )
  const count = (k: string) =>
    questions.filter((q) =>
      k === "hidden" ? q.hidden : !q.hidden && (k === "all" || q.kind === k),
    ).length
  const withReplies = shown.filter((q) => q.replies.length > 0).length

  return (
    <div className="max-w-3xl">
      <p className="mb-6 text-stone-400">
        Every sentence where you asked something (a “?”) or wondered aloud
        (“perhaps”, “maybe”, “I wonder”…). Questions stay open; when a later
        entry answers one, that passage appears below it as an Insight.
      </p>

      <div className="mb-6">
        <FindAnswersButton />
      </div>

      <nav aria-label="Kind" className="mb-8 flex flex-wrap gap-2">
        {KINDS.filter(
          (k) =>
            k.id !== "hidden" || count("hidden") > 0 || filter === "hidden",
        ).map((k) => (
          <Link
            key={k.id}
            href={kindHref(k.id === "all" ? null : k.id)}
            aria-current={filter === k.id ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              filter === k.id
                ? "border-white/30 bg-white/10 text-ink"
                : "border-white/10 text-stone-400 hover:text-stone-200"
            }`}
          >
            {k.label}{" "}
            <span className="font-mono text-xs text-stone-500">
              {count(k.id)}
            </span>
          </Link>
        ))}
      </nav>

      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">
        {shown.length} {shown.length === 1 ? "question" : "questions"} ·{" "}
        {withReplies} with answers
      </h2>
      {shown.length === 0 ? (
        <p className="text-sm text-stone-500">Nothing here yet.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
        </ul>
      )}
    </div>
  )
}
