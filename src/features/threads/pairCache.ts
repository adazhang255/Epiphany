import { createHash } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { parseEmbedding } from "@/features/notes/lib/similarity"
import { dayKey } from "@/features/notes/lib/time"
import { normalize, type Similar } from "@/features/notes/lib/threads"
import { MATCH } from "@/features/threads/match"

// Which highlights (and questions) are alike, kept between visits: comparing
// every pair is the slow part of building threads, and almost nothing
// changes from one visit to the next. Each passage has a fingerprint (its
// words and day); on a visit only passages that are new or changed are
// compared, against the rest. Kept in memory, and in .cache/ so it survives
// a restart. The file holds ids, fingerprints and similarity scores, no text.

export type PairMember = {
  id: string // a highlight's id, or "q-" + a question's
  quote: string
  date: Date
}

type Saved = {
  version: number
  floor: number
  sigs: Record<string, string>
  pairs: [string, string, number][]
}

const VERSION = 1
// pairs are kept down to the loosest match level, so every level can use them
const FLOOR = Math.min(...Object.values(MATCH).map((m) => m.threshold))

const store = globalThis as unknown as {
  __threadPairs?: Map<string, Saved>
  __threadVectors?: Map<string, { sig: string; vec: Float64Array }>
}
const memory = (store.__threadPairs ??= new Map())
const vectors = (store.__threadVectors ??= new Map())

const hash = (text: string) =>
  createHash("sha1").update(text).digest("base64url").slice(0, 16)

// one cache per journal (the demo's and yours stay apart)
function cacheFile() {
  const db = path.resolve(
    (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, ""),
  )
  return path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    ".cache",
    `thread-pairs-${hash(db)}.json`,
  )
}

async function load(file: string): Promise<Saved | null> {
  const known = memory.get(file)
  if (known) return known
  try {
    const saved = JSON.parse(await readFile(file, "utf8")) as Saved
    if (saved.version !== VERSION) return null
    memory.set(file, saved)
    return saved
  } catch {
    return null
  }
}

async function save(file: string, saved: Saved) {
  memory.set(file, saved)
  try {
    await mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(saved))
    await rename(tmp, file) // whole or not at all
  } catch (error) {
    console.warn("[threads] couldn't keep the grouping:", error)
  }
}

// embeddings scaled to length 1, so similarity is a plain dot product
function unit(embedding: number[]) {
  let len = 0
  for (const x of embedding) len += x * x
  len = Math.sqrt(len)
  return Float64Array.from(embedding, (x) => (len ? x / len : 0))
}

async function vectorsFor(members: PairMember[], sigs: Map<string, string>) {
  const need = members.filter((m) => vectors.get(m.id)?.sig !== sigs.get(m.id))
  const quoteIds = need.filter((m) => !m.id.startsWith("q-")).map((m) => m.id)
  const questionIds = need
    .filter((m) => m.id.startsWith("q-"))
    .map((m) => m.id.slice(2))
  const [quotes, questions] = await Promise.all([
    quoteIds.length
      ? prisma.quote.findMany({
          where: { id: { in: quoteIds } },
          select: { id: true, embedding: true },
        })
      : [],
    questionIds.length
      ? prisma.question.findMany({
          where: { id: { in: questionIds } },
          select: { id: true, embedding: true },
        })
      : [],
  ])
  for (const [id, raw] of [
    ...quotes.map((q) => [q.id, q.embedding] as const),
    ...questions.map((q) => [`q-${q.id}`, q.embedding] as const),
  ]) {
    const embedding = parseEmbedding(raw)
    if (embedding) vectors.set(id, { sig: sigs.get(id)!, vec: unit(embedding) })
  }
}

// The alike pairs among `members` (all with an embedding), as indexes into
// it, for buildThreads.
export async function cachedPairs(members: PairMember[]): Promise<Similar> {
  const file = cacheFile()
  const days = members.map((m) => dayKey(m.date))
  const words = members.map((m) => normalize(m.quote))
  const sigs = new Map(
    members.map((m, i) => [m.id, hash(`${words[i]}\u0000${days[i]}`)]),
  )
  const index = new Map(members.map((m, i) => [m.id, i]))

  const saved = await load(file)
  const usable = saved && saved.floor <= FLOOR ? saved : null
  const fresh = (id: string) =>
    usable !== null && sigs.has(id) && usable.sigs[id] === sigs.get(id)
  const stale = members.filter((m) => !fresh(m.id))

  // pairs between passages that haven't changed stand as they were
  const pairs: [string, string, number][] = usable
    ? usable.pairs.filter(([a, b]) => fresh(a) && fresh(b))
    : []

  if (stale.length > 0) {
    await vectorsFor(members, sigs)
    const isStale = new Set(stale.map((m) => m.id))
    for (const s of stale) {
      const i = index.get(s.id)!
      const a = vectors.get(s.id)?.vec
      if (!a) continue
      for (let j = 0; j < members.length; j++) {
        const other = members[j]
        // two changed ones are compared once
        if (j === i || (isStale.has(other.id) && j < i)) continue
        // same-day echoes (or copies) aren't evolution
        if (days[i] === days[j]) continue
        // a pasted copy repeats a thought; it doesn't develop it
        if (words[i] === words[j]) continue
        const b = vectors.get(other.id)?.vec
        if (!b) continue
        const n = Math.min(a.length, b.length)
        let sim = 0
        for (let k = 0; k < n; k++) sim += a[k] * b[k]
        if (sim >= FLOOR) pairs.push([s.id, other.id, sim])
      }
    }
    // (nothing new to keep when only passages left)
  }
  if (stale.length > 0 || !usable || pairs.length !== usable.pairs.length) {
    await save(file, {
      version: VERSION,
      floor: FLOOR,
      sigs: Object.fromEntries(sigs),
      pairs,
    })
  }

  return pairs.map(([a, b, sim]) => {
    const i = index.get(a)!
    const j = index.get(b)!
    return i < j ? { i, j, sim } : { i: j, j: i, sim }
  })
}
