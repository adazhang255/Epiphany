"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { FoundEntry, ProposalView } from "@/features/ask/tools"
import { EntryTitle } from "@/components/EntryTitle"
import { titleText } from "@/features/notes/lib/titles"

export type ProposalStatus =
  | { state: "pending" }
  | { state: "cancelled" }
  | { state: "expired" }
  | { state: "done"; message: string; links?: { id: string; title: string }[] }

const phraseFor = (kind: "delete" | "add", count: number) =>
  `${kind.toUpperCase()} ${count}`

type CardProps<P extends ProposalView = ProposalView> = {
  proposal: P
  status: ProposalStatus
  onStatus: (status: ProposalStatus) => void
}

async function post(token: string, body: object) {
  const res = await fetch("/api/ask/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...body }),
  }).catch(() => null)
  const data = await res?.json().catch(() => null)
  return { ok: Boolean(res?.ok), data }
}

// A change the assistant proposed. Nothing happens until the person confirms
// it in the card; the server checks it all again (api/ask/confirm). Each
// proposal works once.
export function ProposalCard(props: CardProps) {
  const { proposal } = props
  return proposal.kind === "thread" ? (
    <ThreadProposalCard {...props} proposal={proposal} />
  ) : (
    <EntriesProposalCard {...props} proposal={proposal} />
  )
}

// Renaming a thread or taking a passage out of one: shown, then one click.
// (Entries never change, and either can be undone on the Threads page.)
function ThreadProposalCard({
  proposal,
  status,
  onStatus,
}: CardProps<Extract<ProposalView, { kind: "thread" }>>) {
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const { change } = proposal
  const rename = change.action === "rename"

  useEffect(() => {
    if (status.state !== "pending") return
    const wait = proposal.expiresAt - Date.now()
    const timer = setTimeout(() => onStatus({ state: "expired" }), wait)
    return () => clearTimeout(timer)
  }, [proposal.expiresAt, status.state, onStatus])

  async function confirm() {
    setSending(true)
    setError("")
    const { ok, data } = await post(proposal.token, {})
    setSending(false)
    if (!ok) {
      setError(data?.error ?? "Could not reach the server.")
      if (data?.error) onStatus({ state: "expired" })
      return
    }
    onStatus({
      state: "done",
      message: rename
        ? `Renamed the thread to “${change.to}”.`
        : `Took that passage out of “${titleText(change.title)}”. Your entry is unchanged.`,
    })
  }

  async function cancel() {
    await post(proposal.token, { cancel: true })
    onStatus({ state: "cancelled" })
  }

  if (status.state !== "pending") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 px-4 py-3 font-mono text-xs text-stone-400">
        {status.state === "done" && (
          <p className="text-stone-300">
            ✓ {status.message}{" "}
            <Link href="/threads" className="text-ember hover:underline">
              See threads
            </Link>
          </p>
        )}
        {status.state === "cancelled" && "Cancelled. Nothing was changed."}
        {status.state === "expired" &&
          `${error ? `${error} ` : ""}This proposal is no longer valid. Nothing was changed.`}
      </div>
    )
  }

  return (
    <section
      aria-label={rename ? "Proposed thread name" : "Proposed thread removal"}
      className="mt-3 rounded-xl border border-ember/40 bg-ember/[0.04] p-4"
    >
      <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-ember">
        {rename
          ? "✎ Proposed: rename a thread"
          : "⇢ Proposed: take a passage out of a thread"}
      </h3>
      <p className="mt-1 text-xs text-stone-400">
        The assistant suggested this. Nothing has happened yet.
      </p>
      {rename ? (
        <p className="mt-3 font-serif text-stone-300">
          <span className="text-stone-500 line-through">{change.from}</span>
          {" → "}
          <span className="text-stone-100">{change.to}</span>
        </p>
      ) : (
        <div className="mt-3 rounded-lg border border-white/10 px-3 py-2">
          <p className="font-mono text-[11px] text-stone-500">
            {change.date} · from “<EntryTitle title={change.title} />”
          </p>
          <p className="mt-1 font-serif text-sm text-stone-200">
            “{change.quote}”
          </p>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2 font-mono text-xs">
        <button
          type="button"
          onClick={cancel}
          className="rounded-md border border-white/15 px-3 py-1 text-stone-300 hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={sending}
          className="rounded-md bg-ember px-3 py-1 font-bold text-stone-950 disabled:opacity-30"
        >
          {sending ? "Working…" : rename ? "Rename" : "Yes, remove"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  )
}

// Deleting or adding entries: pick them, type the exact phrase, press the
// button.
function EntriesProposalCard({
  proposal,
  status,
  onStatus,
}: CardProps<Extract<ProposalView, { kind: "delete" | "add" }>>) {
  // nothing is selected for deletion until the person picks it
  const [picked, setPicked] = useState<Set<number>>(
    () =>
      new Set(proposal.kind === "add" ? proposal.entries.map((_, i) => i) : []),
  )
  const [drafts, setDrafts] = useState(
    proposal.kind === "add" ? proposal.entries : [],
  )
  const [phrase, setPhrase] = useState("")
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (status.state !== "pending") return
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [status.state])

  const expired = now > proposal.expiresAt
  useEffect(() => {
    if (expired && status.state === "pending") onStatus({ state: "expired" })
  }, [expired, status.state, onStatus])

  const isDelete = proposal.kind === "delete"
  const count = picked.size
  const required = phraseFor(proposal.kind, count)
  const ready = count > 0 && phrase === required && !sending

  function toggle(i: number) {
    setPhrase("")
    setPicked((all) => {
      const next = new Set(all)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function confirm() {
    if (!ready) return
    setSending(true)
    setError("")
    const chosen = [...picked].sort((a, b) => a - b)
    const { ok, data } = await post(
      proposal.token,
      isDelete
        ? {
            phrase,
            ids: chosen.map((i) => (proposal.entries[i] as FoundEntry).id),
          }
        : { phrase, entries: chosen.map((i) => drafts[i]) },
    )
    setSending(false)
    if (!ok) {
      // the token is used up either way; a new request makes a new proposal
      setError(data?.error ?? "Could not reach the server.")
      if (data?.error) onStatus({ state: "expired" })
      return
    }
    onStatus(
      isDelete
        ? {
            state: "done",
            message: `Deleted ${data.deleted} ${data.deleted === 1 ? "entry" : "entries"}. A backup was saved to ${data.backup}.`,
          }
        : {
            state: "done",
            message: `Added ${data.added.length} ${data.added.length === 1 ? "entry" : "entries"}. Highlights will appear once they're read.`,
            links: data.added,
          },
    )
  }

  async function cancel() {
    await post(proposal.token, { cancel: true })
    onStatus({ state: "cancelled" })
  }

  const tone = isDelete
    ? "border-rose-400/40 bg-rose-400/[0.04]"
    : "border-ember/40 bg-ember/[0.04]"

  if (status.state !== "pending") {
    return (
      <div
        className={`mt-3 rounded-xl border px-4 py-3 font-mono text-xs ${
          status.state === "done"
            ? "border-white/10 text-stone-300"
            : "border-white/10 text-stone-500"
        }`}
      >
        {status.state === "done" && (
          <>
            <p>✓ {status.message}</p>
            {status.links && (
              <ul className="mt-2 space-y-1">
                {status.links.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/notes/${l.id}`}
                      className="text-ember hover:underline"
                    >
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {status.state === "cancelled" &&
          `Cancelled. Nothing was ${isDelete ? "deleted" : "added"}.`}
        {status.state === "expired" &&
          `${error ? `${error} ` : ""}This proposal is no longer valid. Nothing was ${isDelete ? "deleted" : "added"}.`}
      </div>
    )
  }

  return (
    <section
      aria-label={isDelete ? "Proposed deletion" : "Proposed new entries"}
      className={`mt-3 rounded-xl border ${tone} p-4`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          className={`font-mono text-xs font-bold uppercase tracking-widest ${
            isDelete ? "text-rose-300" : "text-ember"
          }`}
        >
          {isDelete
            ? `⚠ Proposed: delete ${proposal.entries.length} ${proposal.entries.length === 1 ? "entry" : "entries"}`
            : `✎ Proposed: add ${proposal.entries.length} ${proposal.entries.length === 1 ? "entry" : "entries"}`}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
          expires in{" "}
          {Math.max(0, Math.ceil((proposal.expiresAt - now) / 60_000))} min
        </span>
      </header>
      <p className="mt-1 text-xs text-stone-400">
        The assistant suggested this. Nothing has happened yet.{" "}
        {isDelete
          ? "Tick each entry you want gone, check it, then type the phrase below."
          : "Edit anything you like, untick what you don't want, then type the phrase below."}
      </p>

      {isDelete && (
        <div className="mt-3 flex gap-3 font-mono text-[11px] text-stone-500">
          <button
            type="button"
            className="hover:text-stone-200"
            onClick={() => {
              setPhrase("")
              setPicked(new Set(proposal.entries.map((_, i) => i)))
            }}
          >
            select all
          </button>
          <button
            type="button"
            className="hover:text-stone-200"
            onClick={() => {
              setPhrase("")
              setPicked(new Set())
            }}
          >
            select none
          </button>
        </div>
      )}

      <ul className="mt-2 space-y-2">
        {isDelete
          ? (proposal.entries as FoundEntry[]).map((entry, i) => (
              <li
                key={entry.id}
                className={`rounded-lg border px-3 py-2 ${
                  picked.has(i)
                    ? "border-rose-400/40 bg-rose-400/[0.06]"
                    : "border-white/10"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={picked.has(i)}
                    onChange={() => toggle(i)}
                    className="mt-1 accent-rose-400"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-3">
                      <Link
                        href={`/notes/${entry.id}`}
                        target="_blank"
                        className="font-serif text-stone-100 hover:underline"
                      >
                        <EntryTitle title={entry.title} />
                      </Link>
                      <span className="font-mono text-[11px] text-stone-500">
                        {entry.date} · {entry.words}{" "}
                        {entry.words === 1 ? "word" : "words"}
                        {entry.category && ` · ${entry.category}`}
                      </span>
                      {entry.published && (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
                          public
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap text-xs text-stone-400">
                      {entry.preview || "(empty)"}
                      {entry.words > 50 && "…"}
                    </span>
                  </span>
                </label>
              </li>
            ))
          : drafts.map((entry, i) => (
              <li
                key={i}
                className={`rounded-lg border px-3 py-2 ${
                  picked.has(i)
                    ? "border-ember/40"
                    : "border-white/10 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label="Include this entry"
                    checked={picked.has(i)}
                    onChange={() => toggle(i)}
                    className="mt-2 accent-[#e8c27a]"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={entry.title}
                        aria-label="Title"
                        onChange={(e) =>
                          setDrafts((all) =>
                            all.map((d, j) =>
                              j === i ? { ...d, title: e.target.value } : d,
                            ),
                          )
                        }
                        className="min-w-0 flex-1 rounded border border-white/10 bg-transparent px-2 py-1 font-serif text-stone-100 outline-none focus:border-ember/50"
                      />
                      <input
                        type="date"
                        value={entry.date}
                        aria-label="Date"
                        onChange={(e) =>
                          setDrafts((all) =>
                            all.map((d, j) =>
                              j === i ? { ...d, date: e.target.value } : d,
                            ),
                          )
                        }
                        className="rounded border border-white/10 bg-transparent px-2 py-1 font-mono text-xs text-stone-300 outline-none [color-scheme:dark] focus:border-ember/50"
                      />
                    </div>
                    <textarea
                      value={entry.content}
                      aria-label="Text"
                      rows={Math.min(8, Math.max(2, entry.content.length / 70))}
                      onChange={(e) =>
                        setDrafts((all) =>
                          all.map((d, j) =>
                            j === i ? { ...d, content: e.target.value } : d,
                          ),
                        )
                      }
                      className="w-full rounded border border-white/10 bg-transparent px-2 py-1.5 font-serif text-sm text-stone-200 outline-none focus:border-ember/50"
                    />
                  </div>
                </div>
              </li>
            ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs">
        <label className="flex flex-wrap items-center gap-2 text-stone-400">
          {count === 0 ? (
            <span>
              Select at least one entry to {isDelete ? "delete" : "add"}.
            </span>
          ) : (
            <>
              Type{" "}
              <kbd
                className={`rounded px-1.5 py-0.5 ${
                  isDelete
                    ? "bg-rose-400/15 text-rose-200"
                    : "bg-ember/15 text-ember"
                }`}
              >
                {required}
              </kbd>{" "}
              to confirm
              <input
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    confirm()
                  }
                }}
                spellCheck={false}
                autoComplete="off"
                aria-label={`Type ${required} to confirm`}
                className="w-28 rounded border border-white/15 bg-transparent px-2 py-1 text-stone-100 outline-none focus:border-white/40"
              />
            </>
          )}
        </label>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-white/15 px-3 py-1 text-stone-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!ready}
            className={`rounded-md px-3 py-1 font-bold disabled:cursor-not-allowed disabled:opacity-30 ${
              isDelete
                ? "bg-rose-400 text-stone-950"
                : "bg-ember text-stone-950"
            }`}
          >
            {sending
              ? "Working…"
              : isDelete
                ? `Delete ${count}`
                : `Add ${count}`}
          </button>
        </span>
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  )
}
