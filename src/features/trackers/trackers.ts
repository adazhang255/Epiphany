import { offerUndo } from "@/features/undo/undo"
import { prisma } from "@/lib/prisma"
import {
  chatJSON,
  pickAskModel,
} from "@/features/notes/services/ollama.service"
import {
  cleanLegend,
  formatScale,
  PALETTE,
  parseLegend,
  scaleColors,
  scaleValue,
  storeLegend,
  type LegendItem,
  type Scale,
} from "@/features/trackers/legend"

// Trackers: day-by-day questions you answer yourself on Stats → Trackers
// ("How am I feeling?"), apart from your entries. Ask and the writer profile
// read them as context (see trackerContext).

export type TrackerView = {
  id: string
  name: string
  // set answers to pick from; or, for a scale, none
  legend: LegendItem[]
  // a scale: any number in a range, instead of answers
  scale: Scale | null
  // YYYY-MM-DD → legend key (or, for a scale, the number)
  marks: Record<string, string>
}

// what a tracker is answered with: set answers, or a scale
export type TrackerKind = { legend: LegendItem[] } | { scale: Scale }

// whether a day's stored answer is one the tracker still has
function fits(kind: TrackerKind, value: string) {
  return "scale" in kind
    ? scaleValue(kind.scale, value) !== null
    : kind.legend.some((l) => l.key === value)
}

// null when the database doesn't have the tracker tables yet (run
// `npm run db:push` once)
export async function listTrackers(): Promise<TrackerView[] | null> {
  try {
    const trackers = await prisma.tracker.findMany({
      orderBy: { createdAt: "asc" },
      include: { marks: { select: { day: true, value: true } } },
    })
    return trackers.map((t) => ({
      id: t.id,
      name: t.name,
      ...parseLegend(t.legend),
      marks: Object.fromEntries(t.marks.map((m) => [m.day, m.value])),
    }))
  } catch {
    return null
  }
}

export async function createTracker(name: string, kind: TrackerKind) {
  return prisma.tracker.create({
    data: { name: name.trim().slice(0, 120), legend: storeLegend(kind) },
  })
}

export async function updateTracker(
  id: string,
  change: { name?: string; kind?: TrackerKind },
) {
  const tracker = await prisma.tracker.update({
    where: { id },
    data: {
      ...(change.name ? { name: change.name.trim().slice(0, 120) } : {}),
      ...(change.kind ? { legend: storeLegend(change.kind) } : {}),
    },
  })
  // days answered with something it no longer has (an answer taken out, a
  // number past the scale's new ends) are cleared
  const kind = change.kind
  if (kind) {
    const marks = await prisma.trackerMark.findMany({
      where: { trackerId: id },
      select: { id: true, value: true },
    })
    const gone = marks.filter((m) => !fits(kind, m.value)).map((m) => m.id)
    if (gone.length)
      await prisma.trackerMark.deleteMany({ where: { id: { in: gone } } })
  }
  return tracker
}

// Delete a tracker and its answers. Gives a token to undo it.
export async function deleteTracker(id: string) {
  const tracker = await prisma.tracker.findUniqueOrThrow({
    where: { id },
    include: { marks: true },
  })
  await prisma.tracker.delete({ where: { id } })
  const { marks, ...own } = tracker
  return offerUndo("Tracker deleted", () =>
    prisma.$transaction([
      prisma.tracker.create({ data: own }),
      prisma.trackerMark.createMany({ data: marks }),
    ]),
  )
}

// mark a day (or clear it with null)
export async function setMark(
  trackerId: string,
  day: string,
  value: string | null,
) {
  if (value === null) {
    await prisma.trackerMark.deleteMany({ where: { trackerId, day } })
    return
  }
  // a scale's answer: a number within it, on its steps
  const tracker = await prisma.tracker.findUniqueOrThrow({
    where: { id: trackerId },
    select: { legend: true },
  })
  const { scale } = parseLegend(tracker.legend)
  if (scale) {
    const n = scaleValue(scale, value)
    if (n === null) throw new RangeError("Not a number on this scale")
    value = String(n)
  }
  await prisma.trackerMark.upsert({
    where: { trackerId_day: { trackerId, day } },
    create: { trackerId, day, value },
    update: { value },
  })
}

// ---- a legend suggested by the local model --------------------------------

const SUGGEST = `Someone wants to track something about each day of their life in a journal app, by picking one answer per day. Suggest the answers for their tracker.
- If it's a scale (how good, how much, how often…), give 3 to 5 answers in order from the lowest/worst to the highest/best, and set kind to "scale".
- If the answers are kinds of things (what did I do, where was I…), give 3 to 7 short, distinct answers, and set kind to "categories".
Answers are 1 to 3 words each, plain and everyday, no numbers or emoji.`
const suggestSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["scale", "categories"] },
    answers: { type: "array", items: { type: "string" } },
  },
  required: ["kind", "answers"],
}

export async function suggestLegend(question: string): Promise<LegendItem[]> {
  const reply = await chatJSON<{ kind: string; answers: unknown }>(
    SUGGEST,
    question,
    suggestSchema,
    { model: await pickAskModel(), temperature: 0.2 },
  )
  const items = cleanLegend(reply.answers)
  const colors =
    reply.kind === "scale"
      ? scaleColors(items.length)
      : items.map((_, i) => PALETTE[i % PALETTE.length])
  return items.map((item, i) => ({
    ...item,
    label: item.label.charAt(0).toUpperCase() + item.label.slice(1),
    color: colors[i],
  }))
}

// ---- what Ask and the profile read ---------------------------------------

// The trackers as plain text, most recent days first: "How am I feeling?
// (answers: Low, Okay, Good) 2026-10-18: Good; 2026-10-17: Okay …", or for
// a scale "Sleep (a number from 0 hours to 12 hours) 2026-10-18: 7.5 hours". Only
// days from `since` (YYYY-MM-DD) on, if given; at most `most` days each.
export async function trackerContext({
  since,
  most = 120,
}: { since?: string; most?: number } = {}) {
  const trackers = await listTrackers()
  if (!trackers?.length) return ""
  return trackers
    .map((t) => {
      const scale = t.scale
      const label = new Map(t.legend.map((l) => [l.key, l.label]))
      const answer = (value: string) => {
        if (!scale) return label.get(value)
        const n = scaleValue(scale, value)
        return n === null ? undefined : formatScale(scale, n)
      }
      const days = Object.entries(t.marks)
        .filter(([day, value]) => answer(value) && (!since || day >= since))
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, most)
      if (!days.length) return ""
      const ends = (n: number, end: { label: string }) =>
        `${formatScale(scale!, n)}${end.label ? ` = ${end.label}` : ""}`
      const about = scale
        ? `a number from ${ends(scale.min, scale.low)} to ${ends(scale.max, scale.high)}`
        : `answers: ${t.legend.map((l) => l.label).join(", ")}`
      return `"${t.name}" (${about})\n${days
        .map(([day, value]) => `${day}: ${answer(value)}`)
        .join("; ")}`
    })
    .filter(Boolean)
    .join("\n\n")
}
