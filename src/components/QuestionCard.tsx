"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { HighlightKind } from "@/components/HighlightKind"

export type QuestionView = {
  id: string
  quote: string
  kind: "question" | "wondering"
  // you marked it as not really a question
  hidden: boolean
  noteId: string
  noteTitle: string
  date: string // ISO
  // passages from later entries that answer it (found by "Find answers")
  replies: {
    id: string
    quote: string
    category: string
    noteId: string
    noteTitle: string
    date: string
  }[]
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// A question from an entry, always open, with any answers from later
// entries below it as replies.
export function QuestionCard({ question }: { question: QuestionView }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  // "Not a question" (or undo): hides it from the list, Threads and Find answers
  async function markNotQuestion(notQuestion: boolean) {
    setPending("self")
    await fetch(`/api/questions/${question.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notQuestion }),
    }).catch(() => null)
    setPending(null)
    router.refresh()
  }

  // "Not an answer": unlink the reply; the passage stays a highlight
  async function unlink(replyId: string) {
    setPending(replyId)
    await fetch(`/api/highlights/${replyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyTo: null }),
    }).catch(() => null)
    setPending(null)
    router.refresh()
  }

  return (
    <li className="rounded-xl border border-white/[0.09] bg-panel p-5">
      <p className="flex flex-wrap items-baseline gap-x-1 font-mono text-[11px] uppercase tracking-widest text-stone-500">
        <span
          className={
            question.kind === "question" ? "text-stone-300" : "text-stone-400"
          }
        >
          {question.kind === "question" ? "? Question" : "~ Wondering"}
        </span>{" "}
        · {shortDate(question.date)} · in{" "}
        <Link
          href={`/notes/${question.noteId}`}
          className="underline decoration-stone-700 hover:text-stone-300"
        >
          {question.noteTitle || "Untitled thought"}
        </Link>
        <button
          type="button"
          disabled={pending === "self"}
          onClick={() => markNotQuestion(!question.hidden)}
          title={
            question.hidden
              ? "Put it back in your questions"
              : "Hide it: it isn't really a question"
          }
          className="ml-auto normal-case tracking-normal text-stone-500 underline decoration-stone-700 hover:text-stone-200 disabled:opacity-50"
        >
          {question.hidden ? "Restore" : "Not a question"}
        </button>
      </p>
      <p
        className={`mt-2 font-serif text-lg leading-snug ${question.hidden ? "text-stone-500 line-through decoration-stone-700" : "text-stone-100"}`}
      >
        “{question.quote}”
      </p>

      {question.replies.length > 0 && (
        <ul aria-label="Answers" className="mt-4 space-y-3">
          {question.replies.map((reply) => (
            <li key={reply.id} className="ml-3 border-l-2 border-ember/40 pl-4">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                <span aria-hidden className="text-stone-600">
                  ↳
                </span>
                <HighlightKind category={reply.category} />
                <span>
                  · {shortDate(reply.date)} · in{" "}
                  <Link
                    href={`/notes/${reply.noteId}?h=${reply.id}#h-${reply.id}`}
                    className="underline decoration-stone-700 hover:text-stone-300"
                  >
                    {reply.noteTitle || "Untitled thought"}
                  </Link>
                </span>
                <button
                  type="button"
                  disabled={pending === reply.id}
                  onClick={() => unlink(reply.id)}
                  className="ml-auto text-stone-600 underline hover:text-stone-300"
                >
                  Not an answer
                </button>
              </p>
              <p className="mt-1 font-serif text-[15px] leading-snug text-stone-300">
                “{reply.quote}”
              </p>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
