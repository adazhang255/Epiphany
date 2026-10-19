import { prisma } from "@/lib/prisma"
import {
  chatJSON,
  pickAskModel,
} from "@/features/notes/services/ollama.service"
import {
  cleanLegend,
  PALETTE,
  scaleColors,
  type LegendItem,
} from "@/features/trackers/legend"

// Trackers: day-by-day questions you answer yourself on Custom ("How am I
// feeling?"), apart from your entries. Ask and the writer profile read them
// as context (see trackerContext).

export type TrackerView = {
  id: string
  name: string
  legend: LegendItem[]
  marks: Record<string, string> // YYYY-MM-DD → legend key
}

const parse = (json: string) => {
  try {
    return cleanLegend(JSON.parse(json))
  } catch {
    return []
  }
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
      legend: parse(t.legend),
      marks: Object.fromEntries(t.marks.map((m) => [m.day, m.value])),
    }))
  } catch {
    return null
  }
}

export async function createTracker(name: string, legend: LegendItem[]) {
  return prisma.tracker.create({
    data: { name: name.trim().slice(0, 120), legend: JSON.stringify(legend) },
  })
}

export async function updateTracker(
  id: string,
  change: { name?: string; legend?: LegendItem[] },
) {
  const tracker = await prisma.tracker.update({
    where: { id },
    data: {
      ...(change.name ? { name: change.name.trim().slice(0, 120) } : {}),
      ...(change.legend ? { legend: JSON.stringify(change.legend) } : {}),
    },
  })
  // marks for answers taken out of the legend go with them
  if (change.legend)
    await prisma.trackerMark.deleteMany({
      where: {
        trackerId: id,
        value: { notIn: change.legend.map((l) => l.key) },
      },
    })
  return tracker
}

export async function deleteTracker(id: string) {
  await prisma.tracker.delete({ where: { id } })
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
// (answers: Low, Okay, Good) 2026-10-18: Good; 2026-10-17: Okay …". Only
// days from `since` (YYYY-MM-DD) on, if given; at most `most` days each.
export async function trackerContext({
  since,
  most = 120,
}: { since?: string; most?: number } = {}) {
  const trackers = await listTrackers()
  if (!trackers?.length) return ""
  return trackers
    .map((t) => {
      const label = new Map(t.legend.map((l) => [l.key, l.label]))
      const days = Object.entries(t.marks)
        .filter(([day, value]) => label.has(value) && (!since || day >= since))
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, most)
      if (!days.length) return ""
      return `"${t.name}" (answers: ${t.legend.map((l) => l.label).join(", ")})\n${days
        .map(([day, value]) => `${day}: ${label.get(value)}`)
        .join("; ")}`
    })
    .filter(Boolean)
    .join("\n\n")
}
