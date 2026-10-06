"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ProposalCard, type ProposalStatus } from "@/components/ProposalCard"
import type { FoundEntry, ProposalView } from "@/features/ask/tools"

type SourceRef = {
  n: number
  id: string
  title: string
  date: string
  category: string
}

// what the server says it's doing right now
type Status = "reading" | "thinking" | "proposing"

const STATUS_TEXT: Record<Status, string> = {
  reading: "Reading your entries…",
  thinking: "Thinking…",
  proposing: "Preparing a change for you to review…",
}

// `at`: when it was said (ms). Older saved turns may not have it.
type Turn =
  | { role: "user"; content: string; at?: number }
  | {
      role: "assistant"
      content: string
      sources: SourceRef[]
      pending?: boolean
      error?: string
      stopped?: boolean
      // the question asked to change entries (e.g. "merge"), which Ask can't do yet
      action?: string
      // tool mode: what the assistant looked up and proposed, in order
      steps?: Step[]
      status?: Status
      at?: number
    }
  // output of a /command, shown like terminal output; never sent to the model
  | { role: "system"; content: string; train?: boolean; at?: number }

type Step =
  | { kind: "tool"; name: string; args: Record<string, unknown> }
  | { kind: "found"; entries: FoundEntry[] }
  | { kind: "proposal"; proposal: ProposalView; status: ProposalStatus }

// The conversation is kept in this browser (never on the server), so it
// survives reloads and moving between pages. /new clears it.
const STORAGE_KEY = "ask:conversation:v1"
// What you've typed, for ↑/↓ like a shell. Kept apart from the conversation
// so `clear` doesn't forget it.
const HISTORY_KEY = "ask:history:v1"
const HISTORY_MAX = 100

function loadHistory(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")
    return Array.isArray(saved)
      ? saved.filter((h) => typeof h === "string")
      : []
  } catch {
    return []
  }
}

function remember(text: string) {
  try {
    const history = loadHistory()
    if (history.at(-1) !== text) history.push(text)
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(-HISTORY_MAX)),
    )
  } catch {
    // storage blocked: history just won't be kept
  }
}

// the time a message is said (called from handlers, never during render)
const stamp = () => Date.now()

function clock(at?: number) {
  return at
    ? new Date(at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null
}

// A turn's label with its time, e.g. "YOU · 9:41 PM"
function Label({
  children,
  at,
  className,
}: {
  children: React.ReactNode
  at?: number
  className: string
}) {
  return (
    <p
      className={`font-mono text-[10px] uppercase tracking-[0.2em] ${className}`}
    >
      {children}
      {clock(at) && (
        <time
          dateTime={new Date(at!).toISOString()}
          className="ml-2 tracking-widest opacity-70"
        >
          · {clock(at)}
        </time>
      )}
    </p>
  )
}

function loadTurns(): Turn[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    if (!Array.isArray(saved)) return []
    // an answer cut off by a reload can't resume
    return saved.map((t: Turn) =>
      t.role === "assistant" && t.pending
        ? { ...t, pending: false, stopped: true }
        : t,
    )
  } catch {
    return []
  }
}

function saveTurns(turns: Turn[]) {
  try {
    if (turns.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(turns))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage full or blocked: the conversation just won't persist
  }
}

// "findEntries(maxWords: 5, titleContains: "hi")", like a command line
function callText(name: string, args: Record<string, unknown>) {
  const shown = Object.entries(args ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
  return `${name}(${shown.join(", ")})`
}

function FoundList({ entries }: { entries: FoundEntry[] }) {
  if (entries.length === 0)
    return <p className="font-mono text-xs text-stone-500"> └ no entries</p>
  return (
    <ul className="ml-4 space-y-1 border-l border-white/10 pl-3">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex flex-wrap items-baseline gap-x-3 text-xs"
        >
          <Link
            href={`/notes/${e.id}`}
            className="font-serif text-sm text-stone-300 hover:text-ink hover:underline"
          >
            {e.title || "Untitled"}
          </Link>
          <span className="font-mono text-stone-500">
            {e.date} · {e.words} {e.words === 1 ? "word" : "words"}
          </span>
        </li>
      ))}
    </ul>
  )
}

const COMMANDS: [string, string][] = [
  ["clear, /new", "start a new conversation (also ctrl+L)"],
  ["/stop", "stop the answer being written (also esc or ctrl+C)"],
  ["ls", "list your newest entries"],
  ["pwd, whoami,", "date, echo …  the usual"],
  ["help", "show these commands"],
  ["", ""],
  ["find …", 'e.g. "find entries under 5 words"'],
  ["delete …", "proposes a deletion; you review and confirm it"],
  ["add …", "proposes a new entry; you edit and confirm it"],
]

// Bare terminal commands work without the slash, but only when the whole
// input is the command, so "clear my head?" still goes to the journal.
const BARE =
  /^(clear|cls|reset|help|ls|ll|sl|pwd|whoami|date|exit|stop|echo(\s.*)?)$/i

// sl: the classic punishment for mistyping ls.
const TRAIN = String.raw`      ====        ________                ___________
  _D _|  |_______/        \__I_I_____===__|_________|
   |(_)---  |   H\________/ |   |        =|___ ___|
   /     |  |   H  |  |     |   |         ||_| |_||
  |      |  |   H  |__--------------------| [___] |
  | ________|___H__/__|_____/[][]~\_______|       |
  |/ |   |-----------I_____I [][] []  D   |=======|_
__/ =| o |=-~~\  /~~\  /~~\  /~~\ ____Y___________|__
 |/-=|___|=    ||    ||    ||    |_____/~\___/
  \_/      \O=====O=====O=====O_/      \_/`

function SteamLocomotive() {
  const [gone, setGone] = useState(false)
  if (gone) return <span className="text-stone-600">(the train has left)</span>
  return (
    <div className="overflow-hidden">
      <pre
        onAnimationEnd={() => setGone(true)}
        className="sl-train w-max text-[10px] leading-tight text-ember"
      >
        {TRAIN}
      </pre>
    </div>
  )
}

const STARTERS = [
  "What have I been worrying about lately?",
  "How has my thinking about money changed?",
  "When did I seem happiest?",
  "What questions keep coming back to me?",
]

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// Turn "[2]" or "[4, 5]" citations in the answer into links to the entries.
function withCitations(text: string, sources: SourceRef[]) {
  return text.split(/(\[\d+(?:\s*,\s*\d+)*\])/g).map((part, i) => {
    const numbers = part.match(/^\[([\d,\s]+)\]$/)?.[1]
    const cited = numbers
      ?.split(",")
      .map((n) => sources.find((s) => s.n === Number(n.trim())))
      .filter((s): s is SourceRef => Boolean(s))
    if (!cited?.length) return <span key={i}>{part}</span>
    return (
      <span key={i}>
        {cited.map((source) => (
          <Link
            key={source.n}
            href={`/notes/${source.id}`}
            title={`${source.title || "Untitled"} · ${shortDate(source.date)}`}
            className="mx-0.5 rounded bg-ember/15 px-1 font-mono text-[11px] text-ember no-underline hover:bg-ember/25"
          >
            {source.n}
          </Link>
        ))}
      </span>
    )
  })
}

// Talk with your journal. The conversation is kept in this browser only, and
// the answers come from the models in Ollama on this computer.
// The input works like a terminal prompt: /commands, esc or ctrl+C to stop.
export function AskJournal() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [unembedded, setUnembedded] = useState(0)
  const [indexing, setIndexing] = useState<"idle" | "running" | "failed">(
    "idle",
  )
  const end = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  // follow the answer down the page only while you're at the bottom; scroll
  // up to read and it stops pulling you back
  const follow = useRef(true)
  const loaded = useRef(false)
  // ↑/↓ through what you've typed: where you are, and what you'd started typing
  const [recall, setRecall] = useState<{ index: number; draft: string } | null>(
    null,
  )

  function onHistoryKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
    // what you've typed; before this was kept, fall back to the questions
    // in the saved conversation
    const stored = loadHistory()
    const history = stored.length
      ? stored
      : turns.filter((t) => t.role === "user").map((t) => t.content)
    if (history.length === 0) return
    e.preventDefault()
    if (e.key === "ArrowUp") {
      const index = recall ? Math.max(0, recall.index - 1) : history.length - 1
      setRecall({ index, draft: recall?.draft ?? input })
      setInput(history[index])
    } else if (recall) {
      const index = recall.index + 1
      if (index >= history.length) {
        setInput(recall.draft)
        setRecall(null)
      } else {
        setRecall({ ...recall, index })
        setInput(history[index])
      }
    }
  }

  // restore the last conversation, then keep it saved as it changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage, which the server can't
    setTurns(loadTurns())
    loaded.current = true
  }, [])
  useEffect(() => {
    if (loaded.current) saveTurns(turns)
  }, [turns])

  useEffect(() => {
    const onScroll = () => {
      const fromBottom =
        document.documentElement.scrollHeight -
        (window.scrollY + window.innerHeight)
      follow.current = fromBottom < 120
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (follow.current) end.current?.scrollIntoView({ block: "end" })
  }, [turns])

  function setProposalStatus(
    turnIndex: number,
    stepIndex: number,
    status: ProposalStatus,
  ) {
    setTurns((all) =>
      all.map((turn, i) =>
        i === turnIndex && turn.role === "assistant"
          ? {
              ...turn,
              steps: turn.steps?.map((step, j) =>
                j === stepIndex && step.kind === "proposal"
                  ? { ...step, status }
                  : step,
              ),
            }
          : turn,
      ),
    )
  }

  function stop() {
    controller.current?.abort()
  }

  function clear() {
    stop()
    setTurns([])
    follow.current = true
  }

  // Terminal keys anywhere on the page: esc / ctrl+C stop (ctrl+C still
  // copies when text is selected), ctrl+L clears.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const selecting = (window.getSelection()?.toString() ?? "") !== ""
      if (
        busy &&
        (e.key === "Escape" ||
          (e.ctrlKey && e.key.toLowerCase() === "c" && !selecting))
      ) {
        e.preventDefault()
        stop()
      } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault()
        clear()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  async function indexMissing() {
    setIndexing("running")
    const res = await fetch("/api/embeddings", { method: "POST" }).catch(
      () => null,
    )
    if (res?.ok) {
      setUnembedded(0)
      setIndexing("idle")
    } else setIndexing("failed")
  }

  async function command(text: string) {
    const [first, ...rest] = text.split(/\s+/)
    const name = first.toLowerCase().replace(/^\//, "")
    const print = (content: string, extra: { train?: boolean } = {}) =>
      setTurns((all) => [
        ...all,
        { role: "user", content: text, at: stamp() },
        { role: "system", content, ...extra, at: stamp() },
      ])

    if (["new", "clear", "cls", "reset"].includes(name)) return clear()
    if (name === "stop") return stop()
    if (name === "help")
      return print(
        COMMANDS.map(([c, what]) => `${c.padEnd(14)} ${what}`).join("\n"),
      )
    if (name === "sl") return print("", { train: true })
    if (name === "pwd") return print("~/journal")
    if (name === "whoami") return print("the person who wrote all this")
    if (name === "date") return print(new Date().toString())
    if (name === "echo") return print(rest.join(" "))
    if (name === "exit")
      return print("There's nowhere to exit to. Try clear for a fresh start.")
    if (name === "ls" || name === "ll") {
      const res = await fetch("/api/notebook").catch(() => null)
      const data = res?.ok ? await res.json() : null
      if (!data) return print("ls: couldn't read the notebook")
      const rows = (
        data.notes as { title: string; date: string; content: string }[]
      ).map((n) => {
        const words = n.content.trim().split(/\s+/).filter(Boolean).length
        return `${n.date.slice(0, 10)}  ${String(words).padStart(5)}w  ${n.title || "Untitled"}`
      })
      return print(
        rows.join("\n") +
          (data.nextCursor
            ? `\n… ${data.count - rows.length} more in the Notebook`
            : ""),
      )
    }
    print(`${first}: command not found. Type help to see what works.`)
  }

  async function ask(question: string) {
    const text = question.trim()
    if (!text) return
    setInput("")
    remember(text)
    setRecall(null)
    if (text.startsWith("/") || BARE.test(text)) return command(text)
    if (busy) return
    setBusy(true)
    follow.current = true
    const history = [
      ...turns.filter(
        (t): t is Exclude<Turn, { role: "system" }> => t.role !== "system",
      ),
      { role: "user" as const, content: text },
    ]
    setTurns((all) => [
      ...all,
      { role: "user", content: text, at: stamp() },
      {
        role: "assistant",
        content: "",
        sources: [],
        pending: true,
        at: stamp(),
      },
    ])

    const update = (patch: Partial<Extract<Turn, { role: "assistant" }>>) =>
      setTurns((all) => {
        const last = all.at(-1)
        // cleared mid-answer: there's nothing left to update
        if (last?.role !== "assistant") return all
        return [...all.slice(0, -1), { ...last, ...patch }]
      })

    const addStep = (step: Step) =>
      setTurns((all) => {
        const last = all.at(-1)
        if (last?.role !== "assistant") return all
        return [
          ...all.slice(0, -1),
          { ...last, steps: [...(last.steps ?? []), step] },
        ]
      })

    const abort = new AbortController()
    controller.current = abort
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          messages: history.map((t) => ({ role: t.role, content: t.content })),
        }),
      })
      if (!res.ok || !res.body) throw new Error("The server didn't answer.")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let answer = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line) continue
          const msg = JSON.parse(line)
          if (msg.status) update({ status: msg.status })
          if (msg.action) update({ action: msg.action })
          if (msg.tool) addStep({ kind: "tool", ...msg.tool })
          if (msg.found) addStep({ kind: "found", entries: msg.found })
          if (msg.proposal)
            addStep({
              kind: "proposal",
              proposal: msg.proposal,
              status: { state: "pending" },
            })
          if (msg.sources) {
            update({ sources: msg.sources })
            setUnembedded(msg.unembedded ?? 0)
          }
          if (msg.t) {
            answer += msg.t
            update({ content: answer })
          }
          if (msg.error) update({ error: msg.error })
        }
      }
      // the reply's time is when it finished
      update({ pending: false, at: stamp() })
    } catch (error) {
      if (abort.signal.aborted) update({ pending: false, stopped: true })
      else update({ pending: false, error: (error as Error).message })
    } finally {
      controller.current = null
      setBusy(false)
      field.current?.focus()
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col">
      {turns.length === 0 ? (
        <div className="flex-1 space-y-4">
          <p className="text-stone-400">
            Start with a question, or try one of these:
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border border-white/10 px-3 py-1.5 font-serif text-sm text-stone-300 transition hover:border-white/25 hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol className="flex-1 space-y-6">
          {turns.map((turn, i) =>
            turn.role === "user" ? (
              // your query: an amber prompt block, with a rule before each
              // new exchange so questions are easy to find when scrolling
              <li
                key={i}
                className={i > 0 ? "border-t border-white/[0.06] pt-6" : ""}
              >
                <div className="rounded-r-lg border-l-2 border-ember bg-ember/[0.07] px-4 py-2.5">
                  <Label at={turn.at} className="text-ember/80">
                    You
                  </Label>
                  <p className="mt-1 flex gap-2 font-mono text-[15px] text-ink">
                    <span aria-hidden className="text-ember">
                      ›
                    </span>
                    <span className="whitespace-pre-wrap">{turn.content}</span>
                  </p>
                </div>
              </li>
            ) : turn.role === "system" ? (
              <li key={i} className="border-l-2 border-stone-700 pl-4">
                <Label at={turn.at} className="text-stone-600">
                  System
                </Label>
                {turn.train ? (
                  <div className="mt-1 font-mono">
                    <SteamLocomotive />
                  </div>
                ) : (
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-stone-400">
                    {turn.content}
                  </pre>
                )}
              </li>
            ) : (
              // the computer's reply: a quiet grey rule, no fill
              <li
                key={i}
                className="max-w-[90%] border-l-2 border-stone-700/70 pl-4"
              >
                <Label
                  at={turn.pending ? undefined : turn.at}
                  className="mb-2 text-stone-600"
                >
                  Journal
                </Label>
                {turn.action && (
                  <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-200/90">
                    <span aria-hidden>⚑</span>
                    <span>
                      This asks to <strong>{turn.action}</strong> entries. Ask
                      can find, delete and add entries (each change confirmed by
                      you), but it can&apos;t {turn.action} them yet, so nothing
                      will be changed.
                    </span>
                  </p>
                )}
                {turn.steps
                  ?.filter((step) => step.kind !== "proposal")
                  .map((step, j) =>
                    step.kind === "tool" ? (
                      <p
                        key={j}
                        className="mb-1 font-mono text-xs text-stone-500"
                      >
                        <span className="text-ember">●</span>{" "}
                        {callText(step.name, step.args)}
                      </p>
                    ) : step.kind === "found" ? (
                      <div key={j} className="mb-3">
                        <FoundList entries={step.entries} />
                      </div>
                    ) : null,
                  )}
                {turn.content ? (
                  <p className="whitespace-pre-wrap font-serif text-[17px] leading-relaxed text-stone-200">
                    {withCitations(turn.content, turn.sources)}
                    {turn.pending && (
                      <span className="ml-1 animate-pulse text-ember">▍</span>
                    )}
                  </p>
                ) : turn.pending ? (
                  <p className="text-sm text-stone-500">
                    {turn.status ? STATUS_TEXT[turn.status] : "Starting…"}
                  </p>
                ) : null}
                {turn.steps?.map((step, j) =>
                  step.kind === "proposal" ? (
                    <ProposalCard
                      key={step.proposal.token}
                      proposal={step.proposal}
                      status={step.status}
                      onStatus={(status) => setProposalStatus(i, j, status)}
                    />
                  ) : null,
                )}
                {turn.error && (
                  <p className="mt-2 text-sm text-rose-300/80">{turn.error}</p>
                )}
                {turn.stopped && (
                  <p className="mt-2 font-mono text-xs text-stone-500">
                    ^C stopped
                  </p>
                )}
                {turn.sources.length > 0 && (
                  <ul
                    aria-label="Entries used"
                    className="mt-3 flex flex-wrap gap-2"
                  >
                    {turn.sources.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/notes/${s.id}`}
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-stone-400 transition hover:border-ember/40 hover:text-stone-200"
                        >
                          <span className="font-mono text-ember">{s.n}</span>
                          {s.title || "Untitled"}
                          <span className="text-stone-600">
                            {shortDate(s.date)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {!turn.pending &&
                  !turn.error &&
                  !turn.stopped &&
                  !turn.steps?.length &&
                  turn.sources.length === 0 &&
                  turn.content && (
                    <p className="mt-2 text-xs text-stone-600">
                      No entries matched closely, so this answer cites none.
                    </p>
                  )}
              </li>
            ),
          )}
          <div ref={end} />
        </ol>
      )}

      {unembedded > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-300/80">
          {unembedded === 1
            ? "1 entry can't be searched yet."
            : `${unembedded} entries can't be searched yet.`}
          <button
            type="button"
            onClick={indexMissing}
            disabled={indexing === "running"}
            className="rounded-full border border-amber-300/30 px-2.5 py-0.5 text-amber-200 transition hover:bg-amber-300/10 disabled:opacity-60"
          >
            {indexing === "running" ? "Reading…" : "Make it searchable"}
          </button>
          {indexing === "failed" && (
            <span className="text-rose-300/80">
              Couldn&apos;t reach Ollama. Is it running?
            </span>
          )}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
        className="sticky bottom-4 mt-8 rounded-xl border border-white/10 bg-[#0c0c0d]/95 px-3 pb-2 pt-2.5 font-mono backdrop-blur"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-ember">
            ›
          </span>
          <input
            ref={field}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setRecall(null)
            }}
            onKeyDown={onHistoryKey}
            placeholder={
              busy
                ? "Writing… esc or ctrl+C to stop"
                : turns.length
                  ? "Reply, ask something else, or type help"
                  : "Ask your journal, or type help"
            }
            aria-label="Your question, or a /command"
            autoFocus
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-stone-100 caret-ember outline-none placeholder:text-stone-600"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="flex items-center gap-1.5 rounded-md border border-rose-300/30 px-2.5 py-1 text-xs text-rose-200 transition hover:bg-rose-300/10"
            >
              <span aria-hidden className="h-2 w-2 bg-current" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-stone-900 disabled:opacity-30"
            >
              ↵ Ask
            </button>
          )}
        </div>
        <p className="mt-1.5 flex flex-wrap gap-x-4 border-t border-white/5 pt-1.5 text-[10px] uppercase tracking-widest text-stone-600">
          <span>↵ send</span>
          <span>↑↓ history</span>
          <span className={busy ? "text-stone-300" : ""}>esc / ^C stop</span>
          <span>^L clear screen</span>
          <span>help · clear · ls</span>
        </p>
      </form>
    </div>
  )
}
