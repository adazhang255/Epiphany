"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { showUndo } from "@/components/UndoToast"
import { SaveCancel } from "@/components/SaveCancel"
import { quoteForDay, type KeptQuote } from "@/features/quotes/lib"

type Draft = { text: string; author: string; source: string; note: string }
const EMPTY: Draft = { text: "", author: "", source: "", note: "" }

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null)
  const data = await res?.json().catch(() => null)
  return { ok: Boolean(res?.ok), data }
}

// "— Mary Oliver, Wild Geese"
function Attribution({ quote }: { quote: Draft }) {
  if (!quote.author && !quote.source) return null
  return (
    <p className="mt-2 text-sm text-stone-400">
      —{" "}
      {[quote.author, quote.source && <cite key="s">{quote.source}</cite>]
        .filter(Boolean)
        .flatMap((part, i) => (i ? [", ", part] : [part]))}
    </p>
  )
}

// Writing a quote down, or changing one.
function QuoteForm({
  initial = EMPTY,
  onSave,
  onCancel,
}: {
  initial?: Draft
  onSave: (draft: Draft) => Promise<string | null> // an error, or null
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const field = (key: keyof Draft) => ({
    value: draft[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value })),
  })
  async function save() {
    if (!draft.text.trim()) return setError("Write the quote first.")
    setSaving(true)
    setError("")
    const problem = await onSave(draft)
    setSaving(false)
    if (problem) setError(problem)
  }
  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-stone-100 outline-none focus:border-white/30"
  return (
    <div
      className="space-y-3 rounded-2xl border border-white/[0.07] bg-panel p-5"
      onKeyDown={(e) => {
        if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          save()
        }
      }}
    >
      <textarea
        {...field("text")}
        autoFocus
        rows={3}
        placeholder="The words, as you found them"
        aria-label="The quote"
        className={`${input} resize-y font-serif text-lg`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          {...field("author")}
          placeholder="Who said or wrote it"
          aria-label="Who said or wrote it"
          className={input}
        />
        <input
          {...field("source")}
          placeholder="Where it's from (a book, a talk…)"
          aria-label="Where it's from"
          className={input}
        />
      </div>
      <textarea
        {...field("note")}
        rows={2}
        placeholder="Why it stays with you (optional)"
        aria-label="Why it stays with you"
        className={`${input} resize-y text-sm`}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {error && (
          <p role="alert" className="mr-auto text-sm text-rose-300">
            {error}
          </p>
        )}
        <SaveCancel
          onSave={save}
          onCancel={onCancel}
          saving={saving}
          label={initial === EMPTY ? "Keep it" : "Save changes"}
        />
      </div>
    </div>
  )
}

// The Quotes section: words worth returning to, apart from your entries.
// One for today at the top; the rest, newest first, to search, change or
// remove.
export function QuotesView({
  initial,
  on,
  today,
}: {
  initial: KeptQuote[] | null // null: the table isn't set up yet
  on: boolean
  today: string // YYYY-MM-DD
}) {
  const router = useRouter()
  const [quotes, setQuotes] = useState(initial ?? [])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [q, setQ] = useState("")
  // "another one": steps on from today's
  const [shift, setShift] = useState(0)

  if (initial === null)
    return (
      <Shell>
        <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-stone-400">
          To keep quotes, run{" "}
          <code className="rounded bg-white/10 px-1">npm run db:push</code> once
          (it adds two tables to your journal&apos;s database; nothing else
          changes), then reload.
        </p>
      </Shell>
    )

  const first = quoteForDay(quotes, today)
  const featured = first
    ? quotes[(quotes.indexOf(first) + shift) % quotes.length]
    : null
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = quotes.filter((quote) => {
    const text = [quote.text, quote.author, quote.source, quote.note]
      .join(" ")
      .toLowerCase()
    return words.every((w) => text.includes(w))
  })

  async function add(draft: Draft) {
    const { ok, data } = await send("/api/quotes", "POST", draft)
    if (!ok) return data?.error ?? "Couldn't keep it. Try again."
    setQuotes((all) => [data as KeptQuote, ...all])
    setAdding(false)
    return null
  }
  async function change(id: string, draft: Draft) {
    const { ok, data } = await send(`/api/quotes/${id}`, "PATCH", draft)
    if (!ok) return data?.error ?? "Couldn't save it. Try again."
    setQuotes((all) => all.map((x) => (x.id === id ? (data as KeptQuote) : x)))
    setEditing(null)
    return null
  }
  async function remove(quote: KeptQuote) {
    const at = quotes.indexOf(quote)
    setQuotes((all) => all.filter((x) => x.id !== quote.id))
    const { ok, data } = await send(`/api/quotes/${quote.id}`, "DELETE")
    if (!ok) {
      setQuotes((all) => [...all.slice(0, at), quote, ...all.slice(at)])
      return
    }
    showUndo({
      label: "Quote deleted",
      token: data?.undo,
      onUndo: () =>
        setQuotes((all) =>
          all.some((x) => x.id === quote.id)
            ? all
            : [...all.slice(0, at), quote, ...all.slice(at)],
        ),
    })
  }
  async function takeOut() {
    const { ok } = await send("/api/quotes/section", "POST", { on: false })
    if (!ok) return
    router.push("/notebook")
    router.refresh()
  }

  return (
    <Shell>
      {featured && (
        <figure className="rounded-2xl border border-ember/20 bg-ember/[0.03] px-6 py-6">
          <figcaption className="mb-3 flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ember/80">
            {shift === 0 ? "For today" : "Another"}
            {quotes.length > 1 && (
              <button
                type="button"
                onClick={() => setShift((n) => (n + 1) % quotes.length)}
                className="normal-case tracking-normal text-stone-500 underline hover:text-stone-300"
              >
                Another one
              </button>
            )}
          </figcaption>
          <blockquote className="whitespace-pre-line font-serif text-2xl leading-snug text-ink">
            <span aria-hidden className="text-ember/70">
              “
            </span>
            {featured.text}
            <span aria-hidden className="text-ember/70">
              ”
            </span>
          </blockquote>
          <Attribution quote={featured} />
        </figure>
      )}

      {adding ? (
        <QuoteForm onSave={add} onCancel={() => setAdding(false)} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setEditing(null)
            }}
            className="rounded-full border border-ember/40 bg-ember/10 px-4 py-2 text-sm text-ember transition hover:bg-ember/20"
          >
            + Add a quote
          </button>
          {quotes.length > 5 && (
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a quote…"
              aria-label="Find a quote by its words, who said it or where it's from"
              className="w-full max-w-xs rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:border-white/30"
            />
          )}
          <span className="ml-auto text-xs text-stone-500">
            {words.length
              ? `${shown.length} of ${quotes.length}`
              : `${quotes.length} kept`}
          </span>
        </div>
      )}

      {quotes.length === 0 && !adding ? (
        <p className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center text-stone-500">
          Nothing kept yet. When a line stops you (in a book, a talk, a
          conversation), write it down here.
        </p>
      ) : (
        <ul className="space-y-4">
          {shown.map((quote) =>
            editing === quote.id ? (
              <li key={quote.id}>
                <QuoteForm
                  initial={quote}
                  onSave={(draft) => change(quote.id, draft)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={quote.id}
                className="group/quote rounded-2xl border border-white/[0.07] bg-panel p-5"
              >
                <blockquote className="whitespace-pre-line font-serif text-lg leading-snug text-stone-100">
                  “{quote.text}”
                </blockquote>
                <Attribution quote={quote} />
                {quote.note && (
                  <p className="mt-3 border-l-2 border-white/10 pl-3 text-sm italic text-stone-400">
                    {quote.note}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-stone-600">
                  <span>
                    Kept{" "}
                    {new Date(quote.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="ml-auto flex gap-3 opacity-0 transition focus-within:opacity-100 group-hover/quote:opacity-100 pointer-coarse:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(quote.id)
                        setAdding(false)
                      }}
                      className="text-stone-400 underline hover:text-stone-200 pointer-coarse:py-1.5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(quote)}
                      className="text-stone-500 underline hover:text-rose-300 pointer-coarse:py-1.5"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {on && (
        <p className="pt-6 text-xs text-stone-600">
          Don&apos;t want this tab?{" "}
          <button
            type="button"
            onClick={takeOut}
            className="underline hover:text-stone-300"
          >
            Take Quotes out of the Notebook
          </button>{" "}
          (your quotes are kept, and come back if you add it again).
        </p>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-10">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Quotes
        </p>
        <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
          Words worth keeping
        </h1>
        <p className="mt-3 max-w-2xl text-stone-400">
          Lines from books, people and anywhere else that you want to come back
          to, kept apart from your entries.
        </p>
      </header>
      {children}
    </div>
  )
}
