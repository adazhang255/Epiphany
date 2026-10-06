// The fixed set of topics a day can be about. Fixed (not free-form) so each
// one keeps a stable color across the heatmap, the timeline and note pages.
// Colors are the validated dark-mode categorical slots, in order.
export const TOPICS = [
  { name: "Work", color: "#3987e5" },
  { name: "Creativity", color: "#d95926" },
  { name: "Health", color: "#199e70" },
  { name: "Learning", color: "#c98500" },
  { name: "Relationships", color: "#d55181" },
  { name: "Self", color: "#9085e9" },
] as const

export type TopicName = (typeof TOPICS)[number]["name"]

export const TOPIC_NAMES = TOPICS.map((t) => t.name) as TopicName[]

export function topicColor(name: string) {
  return TOPICS.find((t) => t.name === name)?.color ?? "#8a8a82"
}

// Comma-separated DB column -> clean list.
export function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

// User tags first, then the model's suggestions, without repeats.
export function mergeTags(...lists: string[]) {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const tag of lists.flatMap(splitList)) {
    const key = tag.toLowerCase().replace(/^#/, "")
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(key)
    }
  }
  return merged
}

// What kind of passage a highlight is: your four categories plus Question.
// Set by the AI or by you (select text on an entry page).
export const HIGHLIGHT_CATEGORIES = [
  "Writing",
  "Insight",
  "Event",
  "Emotion",
  "Question",
] as const

export type HighlightType = (typeof HIGHLIGHT_CATEGORIES)[number]

// Highlights made before the types matched your categories.
const LEGACY_TYPES: Record<string, HighlightType> = {
  reflection: "Emotion",
  idea: "Insight",
  action: "Insight",
  memory: "Event",
  general: "Insight",
}

// A category name you typed, tidied: trimmed, single spaces, first letter
// capitalised, at most 24 characters. A built-in name in any case becomes
// that built-in. Empty or unusable gives null.
export function cleanCategoryName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const name = raw
    .replace(/[,\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!name) return null
  const builtin = HIGHLIGHT_CATEGORIES.find(
    (c) => c.toLowerCase() === name.toLowerCase(),
  )
  if (builtin) return builtin
  return (name[0].toUpperCase() + name.slice(1)).slice(0, 24)
}

export const isBuiltinCategory = (name: string) =>
  (HIGHLIGHT_CATEGORIES as readonly string[]).includes(name)

// A highlight's type: a built-in one, an old name mapped to its built-in,
// or a category you made yourself (kept as you named it).
export function highlightType(value: string): string {
  return (
    HIGHLIGHT_CATEGORIES.find((c) => c.toLowerCase() === value.toLowerCase()) ??
    LEGACY_TYPES[value.toLowerCase()] ??
    cleanCategoryName(value) ??
    "Insight"
  )
}

export const HIGHLIGHT_GLYPHS: Record<string, string> = {
  Writing: "✎",
  Insight: "✦",
  Event: "◷",
  Emotion: "♡",
  Question: "?",
}

export const UNLABELED_COLOR = "#5c5c57"

// Why an entry was written: its categories. Stored comma-separated in
// Note.category (any of the four, main one first). Distinct from topics and tags,
// which say what an entry is about.
export const PURPOSES = [
  {
    name: "Writing",
    glyph: "✎",
    meaning:
      "creative writing (fiction, poetry, a story idea, characters, a scene) or notes on the craft of writing",
  },
  {
    name: "Insight",
    glyph: "✦",
    meaning:
      "an idea, opinion, realization or lesson the writer is working out",
  },
  {
    name: "Event",
    glyph: "◷",
    meaning:
      "mainly recounts something that happened: a day, a trip, a meeting, news",
  },
  {
    name: "Emotion",
    glyph: "♡",
    meaning: "mainly processes feelings: worry, grief, joy, guilt, loneliness",
  },
] as const

export type PurposeName = (typeof PURPOSES)[number]["name"]

export const PURPOSE_NAMES = PURPOSES.map((p) => p.name) as PurposeName[]

// One color per category. Unlike the topic colors, these four pass the
// colorblind and normal-vision checks for EVERY pair (not just neighbours in
// a legend), because any two categories can sit side by side in the heatmap.
export const PURPOSE_COLORS: Record<string, string> = {
  Writing: "#008300",
  Insight: "#c98500",
  Event: "#3987e5",
  Emotion: "#d55181",
}

// Valid categories in a stored value; anything else (e.g. the old default
// "Personal") is ignored.
export function parsePurposes(value: string): PurposeName[] {
  const wanted = splitList(value).map((v) => v.toLowerCase())
  // keep the order given: the first is the main category
  const found = wanted
    .map((w) => PURPOSE_NAMES.find((p) => p.toLowerCase() === w))
    .filter((p): p is PurposeName => p !== undefined)
  return Array.from(new Set(found)).slice(0, 2)
}

// An entry's category, read from its highlights: the most common type among
// them (Questions aside). A tie keeps both, in the order they first appear.
// No highlights, no category: entries aren't labelled as a whole, so a note
// with nothing meaningful in it stays uncategorized.
export function purposesFromHighlights(categories: string[]): string[] {
  const counts = new Map<string, number>()
  for (const c of categories) {
    const type = highlightType(c)
    if (type === "Question") continue
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  const top = Math.max(0, ...counts.values())
  return [...counts]
    .filter(([, n]) => n === top && n > 0)
    .map(([type]) => type)
    .slice(0, 2)
}

// The entry's category: the one you chose for it, if any (stored
// comma-separated in Note.ownCategory), else the one from its highlights.
export function entryCategories(
  ownCategory: string | null | undefined,
  highlightCategories: string[],
): string[] {
  const own = splitList(ownCategory ?? "")
    .map(cleanCategoryName)
    .filter((c): c is string => c !== null)
  return own.length
    ? [...new Set(own)]
    : purposesFromHighlights(highlightCategories)
}

// Colors for categories you make: stable per name, and apart from the four
// built-in colors (green, amber, blue, pink): teal, violet, lime, rust,
// sand, slate, mint.
const CUSTOM_COLORS = [
  "#14a3a3",
  "#9a7be0",
  "#9aab2e",
  "#c2603c",
  "#b8955a",
  "#8396ab",
  "#5cc49a",
]

export function categoryColor(name: string) {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name]
  let h = 0
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) | 0
  return CUSTOM_COLORS[Math.abs(h) % CUSTOM_COLORS.length]
}

export const categoryGlyph = (name: string) => HIGHLIGHT_GLYPHS[name] ?? "◆"

// Tone of an entry, scored by the local model from -2 to 2.
export const SENTIMENT_LABELS: Record<number, string> = {
  [-2]: "Very negative",
  [-1]: "Negative",
  0: "Neutral",
  1: "Positive",
  2: "Very positive",
}

// Diverging scale: red (negative) and blue (positive) arms around a neutral
// gray, brighter further from neutral, so a strong day stands out.
export const SENTIMENT_COLORS: Record<number, string> = {
  [-2]: "#e66767",
  [-1]: "#8f3d3c",
  0: "#4a4a46",
  1: "#2a5f9e",
  2: "#5598e7",
}

// Highlight colors: the category colors, plus a neutral light gray for
// Question (always shown with its "?" so color is never the only cue).
export const CATEGORY_COLORS: Record<string, string> = {
  ...PURPOSE_COLORS,
  Question: "#a8a29e",
}

// A tag as typed in a search: lowercase, no leading "#".
export const cleanTag = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/^#+/, "")

// Every tag in use (on entries and highlights), most used first.
export function tagCounts(
  notes: {
    tags: string
    autoTags: string
    quotes: { tags: string }[]
  }[],
) {
  const counts = new Map<string, number>()
  for (const n of notes) {
    const seen = new Set([
      ...mergeTags(n.tags, n.autoTags),
      ...n.quotes.flatMap((q) => splitList(q.tags).map(cleanTag)),
    ])
    for (const t of seen) if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }))
}
