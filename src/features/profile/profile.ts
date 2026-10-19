import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import {
  chatJSON,
  chatStream,
  pickAskModel,
} from "@/features/notes/services/ollama.service"
import { titleText } from "@/features/notes/lib/titles"
import { trackerContext } from "@/features/trackers/trackers"

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

// (git-ignored; never part of the public site). One per database, so the
// demo never shows or replaces yours: writer-profile.json for your journal,
// writer-profile-demo.json for the demo.
const DB = path
  .basename((process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, ""))
  .replace(/\.db$/, "")
  .replace(/[^\w-]/g, "_")
const FILE = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  ".cache",
  DB === "dev" ? "writer-profile.json" : `writer-profile-${DB}.json`,
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

// "Moving toward your goals": asked for separately as data (a goal and one
// step each), then written out here, so it's always short and the same
// shape (a small model filling a longer template drifts). Only in your own
// profile, not the public site's.
const GOALS_PROMPT = `From these journal entries, find up to 3 goals, wishes or things the writer said they want to do, change or get better at. For each give:
- goal: 2 to 5 words, in the writer's own terms
- step: one small, concrete action for this week, under 15 words, starting with a verb, using real details from the entries (a person, place, project or habit they mention)
Each about a different goal. No quotes. Not "reflect", "explore" or "think about". No advice about health or therapy. If they wrote about no goals, return none.`
const goalsSchema = {
  type: "object",
  properties: {
    goals: {
      type: "array",
      items: {
        type: "object",
        properties: { goal: { type: "string" }, step: { type: "string" } },
        required: ["goal", "step"],
      },
    },
  },
  required: ["goals"],
}

const words = (text: string, most: number) => {
  const all = text.split(/\s+/).filter(Boolean)
  return all.length > most ? null : all.join(" ")
}
const VAGUE = /^(reflect|explore|think|consider|try to|continue)\b/i

// The section from the model's goals: each tidied, too long or vague ones
// left out; "" if none are left.
export function goalsSection(raw: unknown) {
  const list = Array.isArray(raw) ? raw : []
  const lines: string[] = []
  for (const item of list) {
    if (lines.length === 3) break
    const clean = (v: unknown) =>
      String(v ?? "")
        .replace(/["“”*_]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    const goal = words(clean(item?.goal).replace(/[.:;,]+$/, ""), 6)
    const first =
      clean(item?.step).match(/^.*?[.!?](?=\s|$)/)?.[0] ?? clean(item?.step)
    const step = words(first.replace(/[,;:–—-]+$/, ""), 18)
    if (!goal || !step || VAGUE.test(step)) continue
    const sentence = /[.!?]$/.test(step) ? step : `${step}.`
    lines.push(
      `* **${goal[0].toUpperCase()}${goal.slice(1)}:** ${sentence[0].toUpperCase()}${sentence.slice(1)}`,
    )
  }
  return lines.length ? `**Moving toward your goals**\n${lines.join("\n")}` : ""
}

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
// public site writes its own, from public entries, while it's built, without
// the goals section).
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
  // their trackers too (own profile only): context, not entries
  const daily = save ? await trackerContext({ most: 180 }).catch(() => "") : ""
  const trackers = daily
    ? `\n\nDaily trackers they fill in themselves (self-reported answers to a question each day, not entries; use them to notice patterns, e.g. how they felt over time, but never invent or quote them as entries):\n\n${daily}`
    : ""
  onStep?.(1, 1)
  const write = async () => {
    let markdown = ""
    for await (const piece of chatStream(
      [
        {
          role: "system",
          content: `${SYSTEM}\n\nJournal entries:\n\n${text}${trackers}`,
        },
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
      // a closing question, despite being asked not to (not a bullet: a
      // suggestion may end in one)
      .replace(/\n+(?![*-]\s)[^\n]*\?\s*$/, "")
      .trim()
    if (markdown.length < 80)
      throw new Error("The model's answer was empty or cut off. Try again.")
    return markdown
  }
  // a second try if the first fails (e.g. the model was busy loading)
  let markdown = await write().catch(() => write())
  if (save) {
    // (a profile without the goals is still worth keeping)
    const goals = await chatJSON<{ goals: unknown }>(
      GOALS_PROMPT,
      text,
      goalsSchema,
      { model: await pickAskModel(), temperature: 0.3, numCtx: 6144 },
    ).catch(() => null)
    const section = goalsSection(goals?.goals)
    if (section) markdown = `${markdown}\n\n${section}`
  }
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
