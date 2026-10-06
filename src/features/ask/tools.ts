import { prisma } from "@/lib/prisma"
import { cosine, parseEmbedding } from "@/features/notes/lib/similarity"
import { entryCategories } from "@/features/notes/lib/topics"
import { embed } from "@/features/notes/services/embeddings.service"
import {
  createProposal,
  MAX_PER_PROPOSAL,
  type NewEntry,
  type ThreadChange,
} from "@/features/ask/proposals"
import { getThreads, type ThreadView } from "@/features/threads/build"
import { cleanThreadName } from "@/features/threads/field"
import type { ThreadRef } from "@/features/threads/membership"

// Tools the Ask assistant can call (Ollama tool calling). findEntries and
// findThreads only read. deleteEntries, addEntries, renameThread and
// removeFromThread change NOTHING: they create a proposal that the person
// reviews and confirms in the app (see proposals.ts).

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "findEntries",
      description:
        "Search the journal. Every filter is optional; combine them. Returns matching entries with id, title, date, word count and the start of the text.",
      parameters: {
        type: "object",
        properties: {
          about: {
            type: "string",
            description: "Find entries whose meaning is close to this text",
          },
          titleContains: { type: "string" },
          textContains: { type: "string" },
          maxWords: {
            type: "number",
            description: "Only entries with at most this many words",
          },
          minWords: { type: "number" },
          after: { type: "string", description: "YYYY-MM-DD" },
          before: { type: "string", description: "YYYY-MM-DD" },
          category: {
            type: "string",
            enum: ["Writing", "Insight", "Event", "Emotion"],
          },
          limit: { type: "number", description: "At most 50, default 20" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteEntries",
      description:
        "PROPOSE deleting the entries your last findEntries call returned. Nothing is deleted: the person reviews the list and confirms it themselves. Call findEntries first with filters that match only what should go.",
      parameters: {
        type: "object",
        properties: {
          ids: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional: only some of the last results. Leave out to propose all of them.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "addEntries",
      description:
        "PROPOSE adding new entries, using exactly the words the person gave. Nothing is saved until they review and confirm.",
      parameters: {
        type: "object",
        properties: {
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                date: { type: "string", description: "YYYY-MM-DD" },
              },
              required: ["title", "content"],
            },
          },
        },
        required: ["entries"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "findThreads",
      description:
        "List threads (passages from different days about the same idea). Returns each thread's number, title and its passages, numbered, with dates.",
      parameters: {
        type: "object",
        properties: {
          about: {
            type: "string",
            description:
              "Optional: only threads whose title or passages mention these words",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "renameThread",
      description:
        "PROPOSE a new name for a thread from your last findThreads call. Nothing changes until the person confirms.",
      parameters: {
        type: "object",
        properties: {
          thread: {
            type: "number",
            description: "The thread's number from findThreads",
          },
          name: { type: "string", description: "The new name" },
        },
        required: ["thread", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "removeFromThread",
      description:
        "PROPOSE taking one passage out of a thread from your last findThreads call. The entry itself is not changed. Nothing changes until the person confirms.",
      parameters: {
        type: "object",
        properties: {
          thread: {
            type: "number",
            description: "The thread's number from findThreads",
          },
          passage: {
            type: "number",
            description: "The passage's number within that thread",
          },
        },
        required: ["thread", "passage"],
      },
    },
  },
]

export type FoundEntry = {
  id: string
  title: string
  date: string
  words: number
  category: string
  published: boolean
  preview: string
}

// What the UI shows for a proposal (the server keeps the token's details).
export type ProposalView =
  | {
      token: string
      kind: "delete"
      expiresAt: number
      entries: FoundEntry[]
    }
  | {
      token: string
      kind: "add"
      expiresAt: number
      entries: NewEntry[]
    }
  | {
      token: string
      kind: "thread"
      expiresAt: number
      change: ThreadChange
    }

// Everything one Ask request needs to run tools: entries found so far (the
// only ones that may be proposed for deletion) and a way to tell the UI.
export type ToolContext = {
  seen: Set<string>
  // ids from the latest findEntries call, in order
  lastFound: string[]
  // threads from the latest findThreads call, numbered from 1
  lastThreads: ThreadView[]
  emit: (event: object) => void
}

export const wordCount = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length

const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function parseDay(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const num = (value: unknown) => {
  const n = typeof value === "string" ? Number(value) : value
  return typeof n === "number" && Number.isFinite(n) ? n : null
}
// Small models sometimes send a list as a JSON string ('["a","b"]') or
// "a, b"; accept both.
function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value !== "string" || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return value.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""))
  }
}

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null

function view(note: {
  id: string
  title: string
  date: Date
  content: string
  ownCategory: string
  quotes: { category: string }[]
  published: boolean
}): FoundEntry {
  return {
    id: note.id,
    title: note.title,
    date: day(note.date),
    words: wordCount(note.content),
    category: entryCategories(
      note.ownCategory,
      note.quotes.map((q) => q.category),
    ).join(", "),
    published: note.published,
    preview: note.content.slice(0, 280),
  }
}

async function findEntries(args: Record<string, unknown>, ctx: ToolContext) {
  const after = parseDay(args.after)
  const before = parseDay(args.before)
  const titleContains = str(args.titleContains)?.toLowerCase()
  const textContains = str(args.textContains)?.toLowerCase()
  const maxWords = num(args.maxWords)
  const minWords = num(args.minWords)
  const category = str(args.category)?.toLowerCase()
  const about = str(args.about)
  const limit = Math.min(50, Math.max(1, num(args.limit) ?? 20))

  const notes = await prisma.note.findMany({
    where: {
      date: {
        ...(after ? { gte: after } : {}),
        ...(before ? { lte: before } : {}),
      },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      date: true,
      content: true,
      quotes: { select: { category: true } },
      ownCategory: true,
      published: true,
      embedding: true,
    },
  })

  let matches = notes.filter((n) => {
    const words = wordCount(n.content)
    return (
      (!titleContains || n.title.toLowerCase().includes(titleContains)) &&
      (!textContains || n.content.toLowerCase().includes(textContains)) &&
      (maxWords === null || words <= maxWords) &&
      (minWords === null || words >= minWords) &&
      (!category ||
        entryCategories(
          n.ownCategory,
          n.quotes.map((q) => q.category),
        ).some((c) => c.toLowerCase() === category))
    )
  })

  if (about) {
    const [query] = await embed([about])
    matches = matches
      .map((n) => {
        const vec = parseEmbedding(n.embedding)
        return { n, score: vec ? cosine(query, vec) : 0 }
      })
      .filter((m) => m.score >= 0.6)
      .sort((a, b) => b.score - a.score)
      .map((m) => m.n)
  }

  const found = matches.slice(0, limit).map(view)
  for (const entry of found) ctx.seen.add(entry.id)
  ctx.lastFound = found.map((e) => e.id)
  ctx.emit({ found })
  return {
    total: matches.length,
    shown: found.length,
    entries: found.map(({ id, title, date, words, preview }) => ({
      id,
      title,
      date,
      words,
      preview: preview.slice(0, 120),
    })),
  }
}

async function deleteEntries(args: Record<string, unknown>, ctx: ToolContext) {
  const asked = list(args.ids).map(String)
  // only entries this request actually found: never a guessed or remembered
  // id. No (usable) ids means "the last search's results".
  const valid = [...new Set(asked)].filter((id) => ctx.seen.has(id))
  const ids = valid.length > 0 ? valid : ctx.lastFound
  const refused = asked.length - valid.length
  if (ids.length === 0) {
    return {
      error:
        "Nothing to propose. Call findEntries first to find the entries. Nothing was deleted.",
    }
  }
  if (ids.length > MAX_PER_PROPOSAL) {
    return {
      error: `At most ${MAX_PER_PROPOSAL} entries per proposal. Nothing was deleted.`,
    }
  }

  const notes = await prisma.note.findMany({
    where: { id: { in: ids } },
    orderBy: { date: "desc" },
    include: { quotes: { select: { category: true } } },
  })
  const proposal = createProposal({
    kind: "delete",
    notes: notes.map((n) => ({ id: n.id, updatedAt: n.updatedAt.getTime() })),
  })
  const shown: ProposalView = {
    token: proposal.token,
    kind: "delete",
    expiresAt: proposal.expiresAt,
    entries: notes.map(view),
  }
  ctx.emit({ proposal: shown })
  return {
    status: "proposed",
    entries: notes.length,
    ignoredIds: refused,
    note: "NOTHING HAS BEEN DELETED. The person must review and confirm in the app. Tell them to check the list and confirm if they agree.",
  }
}

async function addEntries(args: Record<string, unknown>, ctx: ToolContext) {
  const raw = list(args.entries)
  const entries: NewEntry[] = raw
    .map((e) => {
      const entry = (e ?? {}) as Record<string, unknown>
      const content = str(entry.content)
      if (!content) return null
      const date = parseDay(entry.date) ?? new Date()
      return {
        title: (str(entry.title) ?? "A thought").slice(0, 200),
        content: content.slice(0, 20_000),
        date: day(date),
      }
    })
    .filter((e): e is NewEntry => e !== null)
  if (entries.length === 0) {
    return { error: "Each entry needs some text. Nothing was added." }
  }
  if (entries.length > MAX_PER_PROPOSAL) {
    return {
      error: `At most ${MAX_PER_PROPOSAL} entries per proposal. Nothing was added.`,
    }
  }

  const proposal = createProposal({ kind: "add", entries })
  const shown: ProposalView = {
    token: proposal.token,
    kind: "add",
    expiresAt: proposal.expiresAt,
    entries,
  }
  ctx.emit({ proposal: shown })
  return {
    status: "proposed",
    entries: entries.length,
    note: "NOTHING HAS BEEN SAVED. The person can edit the entries, then must confirm in the app.",
  }
}

// words in a request that don't say which thread it means
const SKIP = new Set(
  "the and for from with about that this into out its thread threads rename retitle call name named remove take drop delete passage passages one called please can you".split(
    " ",
  ),
)

// the words in a request that could pick out a thread or passage
const requestWords = (text: string) => [
  ...new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter((w) => w.length > 2 && !SKIP.has(w)),
  ),
]

// what a thread is called: its name, the model's title, or its first words
const threadTitle = (t: ThreadView) =>
  t.title ?? `${t.members[0].quote.split(/\s+/).slice(0, 6).join(" ")}…`

const threadRef = (t: ThreadView): ThreadRef => ({
  id: t.id,
  kind: t.kind,
  questionId: t.questionId,
  memberIds: t.members.map((m) => m.id),
})

export async function findThreads(
  args: Record<string, unknown>,
  ctx: ToolContext,
) {
  const about = str(args.about)?.toLowerCase()
  const { threads } = await getThreads()
  const words = requestWords(about ?? "")
  // best matches first: threads mentioning more of the words
  const matches = words.length
    ? threads
        .map((t) => {
          const text = [threadTitle(t), ...t.members.map((m) => m.quote)]
            .join(" ")
            .toLowerCase()
          return { t, score: words.filter((w) => text.includes(w)).length }
        })
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((m) => m.t)
    : threads
  const shown = matches.slice(0, 20)
  ctx.lastThreads = shown
  return {
    total: matches.length,
    threads: shown.map((t, i) => ({
      thread: i + 1,
      title: threadTitle(t),
      // a question's thread is titled by its question
      canRename: t.kind !== "qa",
      passages: t.members.map((m, j) => ({
        passage: j + 1,
        date: day(m.date),
        text: m.quote.slice(0, 160),
      })),
    })),
  }
}

// the thread the model means: its number, or failing that its title
function pickThread(value: unknown, ctx: ToolContext) {
  const n = num(value)
  if (n !== null) return ctx.lastThreads[n - 1] ?? null
  const title = str(value)?.toLowerCase()
  return title
    ? (ctx.lastThreads.find((t) => threadTitle(t).toLowerCase() === title) ??
        null)
    : null
}

// The passage a request describes ("take the walking home bit out of its
// thread"): the one, among the threads found, sharing the most of its words.
export function bestPassage(text: string, ctx: ToolContext) {
  const words = requestWords(text)
  let best: { thread: number; passage: number; score: number } | null = null
  ctx.lastThreads.forEach((t, i) =>
    t.members.forEach((m, j) => {
      // a question's own question stays in its thread
      if (t.kind === "qa" && j === 0) return
      const quote = m.quote.toLowerCase()
      const score = words.filter((w) => quote.includes(w)).length
      if (score > (best?.score ?? 0))
        best = { thread: i + 1, passage: j + 1, score }
    }),
  )
  const found = best as { thread: number; passage: number } | null
  return found && { thread: found.thread, passage: found.passage }
}

// Called without (a valid number from) findThreads: hand over the list, so
// the next call can use the right number.
async function unknownThread(ctx: ToolContext) {
  const listed = ctx.lastThreads.length ? null : await findThreads({}, ctx)
  return {
    error:
      "Unknown thread: use a thread number from findThreads. Nothing was changed. Pick the matching thread below and call again.",
    ...(listed ?? {
      threads: ctx.lastThreads.map((t, i) => ({
        thread: i + 1,
        title: threadTitle(t),
      })),
    }),
  }
}

function proposeThread(change: ThreadChange, ctx: ToolContext) {
  const proposal = createProposal({ kind: "thread", change })
  ctx.emit({
    proposal: {
      token: proposal.token,
      kind: "thread",
      expiresAt: proposal.expiresAt,
      change,
    } satisfies ProposalView,
  })
}

async function renameThread(args: Record<string, unknown>, ctx: ToolContext) {
  const thread = pickThread(args.thread, ctx)
  if (!thread) return await unknownThread(ctx)
  if (thread.kind === "qa") {
    return {
      error:
        "That thread is titled by its question and can't be renamed. Nothing was changed.",
    }
  }
  const name = cleanThreadName(args.name)
  if (!name) return { error: "Give the new name. Nothing was changed." }
  proposeThread(
    {
      action: "rename",
      thread: threadRef(thread),
      from: threadTitle(thread),
      to: name,
    },
    ctx,
  )
  return {
    status: "proposed",
    note: "NOTHING HAS BEEN RENAMED. The person must confirm in the app.",
  }
}

async function removeFromThread(
  args: Record<string, unknown>,
  ctx: ToolContext,
) {
  const thread = pickThread(args.thread, ctx)
  if (!thread) return await unknownThread(ctx)
  const index = num(args.passage)
  const member = index === null ? null : thread.members[index - 1]
  if (!member) {
    return {
      error: `That thread has passages 1 to ${thread.members.length}. Nothing was changed.`,
    }
  }
  if (thread.kind === "qa" && index === 1) {
    return {
      error:
        "Passage 1 is the question the thread is about; it stays. Nothing was changed.",
    }
  }
  proposeThread(
    {
      action: "remove",
      thread: threadRef(thread),
      title: threadTitle(thread),
      item: member.id,
      quote: member.quote,
      date: day(member.date),
    },
    ctx,
  )
  return {
    status: "proposed",
    note: "NOTHING HAS BEEN REMOVED. The person must confirm in the app.",
  }
}

const RUNNERS: Record<
  string,
  (args: Record<string, unknown>, ctx: ToolContext) => Promise<object>
> = {
  findEntries,
  deleteEntries,
  addEntries,
  findThreads,
  renameThread,
  removeFromThread,
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
) {
  const run = RUNNERS[name]
  if (!run) return { error: `Unknown tool ${name}.` }
  try {
    return await run(args ?? {}, ctx)
  } catch (error) {
    console.error("[ask tool]", name, error)
    return { error: `${name} failed. Nothing was changed.` }
  }
}
