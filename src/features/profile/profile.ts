import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import {
  chatStream,
  pickAskModel,
} from "@/features/notes/services/ollama.service"
import { titleText } from "@/features/notes/lib/titles"

// A portrait of the writer, the way Ask answers: the local model reads a
// dozen entries spread across the whole journal (title, date, the start of
// the text and the passages you marked) and writes a short profile in its
// own words, quoting yours: core themes, interests and thought patterns,
// changes over time, and an overall impression. Kept in a file so it's only
// rewritten when you ask.

export type SavedProfile = {
  markdown: string // the profile, in simple Markdown
  generatedAt: string
  entries: number // how many entries the journal has
  read: number // how many it read
}

// (git-ignored; never part of the public site)
const FILE = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  ".cache",
  "writer-profile.json",
)

// entries read, spread evenly through time, and how much of each
const SAMPLE = 10
const ENTRY_CHARS = 450

const SYSTEM = `You are a thoughtful companion helping someone see themselves in their own private journal. Below are entries from across it, oldest first. Write about the writer, speaking to them as "you". Use ONLY these entries; never invent people, events or details. Quote their own words briefly, with the entry title in parentheses. Notice how their thinking changed over time. Be warm, honest and specific; don't diagnose.`

// (small models follow the last message best, so the shape goes there)
const SHAPE = `Write my profile, speaking to me as "you" throughout (never "the writer", never a name: names in the entries are other people or characters). Fill in exactly this template, keeping the four bold headings and the bullets, under 220 words in all, no introduction and no question at the end:

**Core themes**
(2 sentences)

**Interests and thought patterns**
* **(label):** (one sentence with a short quote and its entry title)
* **(label):** (…)
* **(label):** (…)

**Changes over time**
(2 sentences)

**Overall impression**
(1 sentence)`

// a dozen entries spread across the journal, oldest first
async function sample() {
  const notes = await prisma.note.findMany({
    orderBy: { date: "asc" },
    select: {
      title: true,
      content: true,
      date: true,
      quotes: { select: { quote: true }, take: 3 },
    },
  })
  const step = Math.max(1, notes.length / SAMPLE)
  const picked = Array.from(
    { length: Math.min(SAMPLE, notes.length) },
    (_, i) => notes[Math.floor(i * step)],
  )
  const text = picked
    .map((n, i) => {
      const day = n.date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
      const marked = n.quotes.length
        ? `\nMarked: ${n.quotes.map((q) => `"${q.quote}"`).join(" ")}`
        : ""
      return `[${i + 1}] "${titleText(n.title)}" (${day})\n${n.content.slice(0, ENTRY_CHARS)}${marked}`
    })
    .join("\n\n---\n\n")
  return { text, entries: notes.length, read: picked.length }
}

// Ask the local model for the profile. Saved unless `save` is false (the
// public site writes its own, from public entries, while it's built).
export async function writeProfile({
  save = true,
  onStep,
}: {
  save?: boolean
  // told when the model starts (for the background job's progress)
  onStep?: (step: number, of: number) => void
} = {}) {
  const { text, entries, read } = await sample()
  if (entries === 0) return null
  onStep?.(1, 1)
  const write = async () => {
    let markdown = ""
    for await (const piece of chatStream(
      [
        { role: "system", content: `${SYSTEM}\n\nJournal entries:\n\n${text}` },
        { role: "user", content: SHAPE },
      ],
      {
        model: await pickAskModel(),
        temperature: 0.4,
        numPredict: 480,
        numCtx: 6144,
      },
    ))
      markdown += piece
    markdown = markdown
      .trim()
      // a closing question, despite being asked not to
      .replace(/\n+[^\n]*\?\s*$/, "")
      .trim()
    if (markdown.length < 80)
      throw new Error("The model's answer was empty or cut off. Try again.")
    return markdown
  }
  // a second try if the first fails (e.g. the model was busy loading)
  const markdown = await write().catch(() => write())
  const saved: SavedProfile = {
    markdown,
    generatedAt: new Date().toISOString(),
    entries,
    read,
  }
  if (save) {
    await mkdir(path.dirname(FILE), { recursive: true })
    await writeFile(FILE, JSON.stringify(saved, null, 2))
  }
  return saved
}

export async function readProfile(): Promise<SavedProfile | null> {
  try {
    const saved = JSON.parse(await readFile(FILE, "utf8"))
    // (one written by an earlier version: write it again)
    return typeof saved?.markdown === "string" ? saved : null
  } catch {
    return null
  }
}

// ---- writing it in the background ----------------------------------------
// One job at a time for this server's lifetime: the button starts it and the
// page checks back, so you can leave Stats while the model reads.

export type ProfileJob = {
  running: boolean
  step: number
  of: number
  startedAt: string | null
  error: string | null
}

const jobs = globalThis as unknown as { __profileJob?: ProfileJob }
const idle: ProfileJob = {
  running: false,
  step: 0,
  of: 1,
  startedAt: null,
  error: null,
}

export const profileJob = (): ProfileJob => jobs.__profileJob ?? idle

export function startProfileJob() {
  if (profileJob().running) return profileJob()
  const job: ProfileJob = {
    running: true,
    step: 0,
    of: 1,
    startedAt: new Date().toISOString(),
    error: null,
  }
  jobs.__profileJob = job
  writeProfile({
    onStep: (step, of) => {
      job.step = step
      job.of = of
    },
  })
    .then((saved) => {
      if (!saved) job.error = "Write a few entries first."
    })
    .catch((error: Error) => {
      job.error = error.message || "Couldn't write the profile."
    })
    .finally(() => {
      job.running = false
    })
  return job
}
