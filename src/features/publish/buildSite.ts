import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { findQuote, type QuoteRange } from "@/features/notes/lib/findQuote"
import { parseEmbedding } from "@/features/notes/lib/similarity"
import { buildThreads, type ThreadQuote } from "@/features/notes/lib/threads"
import {
  dayKey,
  describeGap,
  formatDay,
  formatLongDate,
  formatMonth,
  monthKey,
} from "@/features/notes/lib/time"
import {
  HIGHLIGHT_GLYPHS,
  highlightType,
  entryCategories,
  PURPOSE_COLORS,
  PURPOSES,
  splitList,
} from "@/features/notes/lib/topics"
import { SITE_CSS, WALKER_JS, WALKER_SVG } from "@/features/publish/templates"

// The public site is written here. It is meant to become its own (public) git
// repository for GitHub Pages, separate from this private journal.
// (Read and written at runtime only, so the bundler shouldn't trace it.)
export const PUBLISH_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.PUBLISH_DIR ?? "public-site",
)

// Everything the builder generates. Only these are deleted on rebuild, so a
// .git folder, CNAME or README you add to the site folder survives.
const GENERATED = [
  "index.html",
  "threads.html",
  "entries",
  "assets",
  ".nojekyll",
  "site.json",
]

const VISIBLE_HIGHLIGHTS = 3
const THREAD_THRESHOLD = 0.8

export type SiteSettings = {
  title: string
  description: string
  author: string
}

export type SiteInfo = SiteSettings & {
  builtAt: string | null
  entries: number
}

const DEFAULTS: SiteSettings = {
  title: "Reflections",
  description: "Passages worth keeping, laid out across time.",
  author: "",
}

export async function readSiteInfo(): Promise<SiteInfo> {
  try {
    const raw = JSON.parse(
      await readFile(
        path.join(/*turbopackIgnore: true*/ PUBLISH_DIR, "site.json"),
        "utf8",
      ),
    )
    return { ...DEFAULTS, builtAt: null, entries: 0, ...raw }
  } catch {
    return { ...DEFAULTS, builtAt: null, entries: 0 }
  }
}

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

type PublishedNote = Awaited<ReturnType<typeof loadPublished>>[number] & {
  slug: string
}

async function loadPublished() {
  return prisma.note.findMany({
    where: { published: true },
    include: { quotes: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  })
}

function shell({
  settings,
  title,
  root,
  current,
  hasThreads,
  body,
  script = false,
}: {
  settings: SiteSettings
  title: string
  root: string // relative path back to the site root: "" or "../"
  current: "home" | "threads" | null
  hasThreads: boolean
  body: string
  script?: boolean
}) {
  const nav = [
    `<a href="${root}index.html"${current === "home" ? ' aria-current="page"' : ""}>Timeline</a>`,
    hasThreads
      ? `<a href="${root}threads.html"${current === "threads" ? ' aria-current="page"' : ""}>Threads</a>`
      : "",
  ].join("")
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(settings.description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Space+Mono:wght@400;700&family=Work+Sans:wght@400;500&display=swap">
<link rel="stylesheet" href="${root}assets/site.css">
</head>
<body>
<header class="site"><div class="wrap"><a class="brand" href="${root}index.html">${esc(settings.title)}</a><nav>${nav}</nav></div></header>
<main class="wrap">${body}</main>
<footer class="site">${settings.author ? `Written by ${esc(settings.author)} · ` : ""}Written slowly, kept quietly.</footer>
${script ? `<script src="${root}assets/walker.js" defer></script>` : ""}
</body>
</html>
`
}

function purposesHtml(purposes: string[]) {
  return purposes
    .map((name) => {
      const glyph = PURPOSES.find((p) => p.name === name)?.glyph ?? ""
      return `<span class="purpose" style="background:${PURPOSE_COLORS[name]}"><span aria-hidden="true">${glyph}</span>${esc(name)}</span>`
    })
    .join("")
}

function cardHtml(note: PublishedNote, quote: PublishedNote["quotes"][number]) {
  return `<li><a class="card" href="entries/${note.slug}.html#h-${quote.id}"><span class="kind">${esc(
    `${HIGHLIGHT_GLYPHS[highlightType(quote.category)]} ${highlightType(quote.category)}`,
  )}</span><q>${esc(quote.quote)}</q></a></li>`
}

function renderIndex(
  notes: PublishedNote[],
  settings: SiteSettings,
  hasThreads: boolean,
) {
  const months: {
    key: string
    label: string
    year: number
    days: PublishedNote[][]
  }[] = []
  for (const note of notes) {
    let month = months.at(-1)
    if (!month || month.key !== monthKey(note.date)) {
      month = {
        key: monthKey(note.date),
        label: formatMonth(note.date),
        year: note.date.getFullYear(),
        days: [],
      }
      months.push(month)
    }
    const day = month.days.at(-1)
    if (day && dayKey(day[0].date) === dayKey(note.date)) day.push(note)
    else month.days.push([note])
  }

  const timeline = months
    .map((month) => {
      const days = month.days
        .map((day) => {
          const date = day[0].date
          const entries = day
            .map((note) => {
              const shown = note.quotes.slice(0, VISIBLE_HIGHLIGHTS)
              const hidden = note.quotes.slice(VISIBLE_HIGHLIGHTS)
              return `<article class="entry">
<a class="entry-title" href="entries/${note.slug}.html">${esc(note.title || "Untitled thought")}</a>
<div class="meta">${purposesHtml(
                entryCategories(
                  note.ownCategory,
                  note.quotes.map((q) => q.category),
                ),
              )}</div>
${shown.length ? `<ul class="cards">${shown.map((q) => cardHtml(note, q)).join("")}</ul>` : ""}
${
  hidden.length
    ? `<details class="more"><summary><span aria-hidden="true">…</span><span class="count">${hidden.length} more</span><span class="less">Show fewer</span></summary><ul class="cards">${hidden
        .map((q) => cardHtml(note, q))
        .join("")}</ul></details>`
    : ""
}
</article>`
            })
            .join("\n")
          return `<section class="day" data-day-label="${esc(
            `${formatDay(date)} ${date.getFullYear()}`,
          )}"><time datetime="${dayKey(date)}">${esc(formatDay(date))}</time>${entries}</section>`
        })
        .join("\n")
      return `<section class="month" id="m-${month.key}"><h2>${esc(month.label)} <small>${month.year}</small></h2>${days}</section>`
    })
    .join("\n")

  const body = `<div class="intro"><p class="eyebrow">Highlights</p><h1>${esc(settings.title)}</h1><p class="lede">${esc(
    settings.description,
  )}</p></div>
${
  notes.length === 0
    ? `<p class="lede">Nothing published yet.</p>`
    : `<div class="timeline"><div class="spine" aria-hidden="true"></div><div class="walker-track"><div class="walker">${WALKER_SVG}<span class="bubble"></span></div></div>${timeline}</div>`
}`
  return shell({
    settings,
    title: settings.title,
    root: "",
    current: "home",
    hasThreads,
    body,
    script: true,
  })
}

function renderEntry(
  note: PublishedNote,
  earlier: PublishedNote | undefined,
  later: PublishedNote | undefined,
  settings: SiteSettings,
  hasThreads: boolean,
) {
  // mark highlights in the text, earliest first, skipping overlaps
  const located = note.quotes
    .map((q) => ({ q, range: findQuote(note.content, q.quote) }))
    .filter(
      (x): x is { q: (typeof note.quotes)[number]; range: QuoteRange } =>
        x.range !== null,
    )
    .sort((a, b) => a.range.start - b.range.start)
  let cursor = 0
  let text = ""
  for (const { q, range } of located) {
    if (range.start < cursor) continue
    text += esc(note.content.slice(cursor, range.start))
    text += `<mark id="h-${q.id}">${esc(note.content.slice(range.start, range.end))}</mark>`
    cursor = range.end
  }
  text += esc(note.content.slice(cursor))

  const neighbor = (
    n: PublishedNote | undefined,
    cls: string,
    label: string,
  ) =>
    n
      ? `<a class="${cls}" href="${n.slug}.html"><span>${label}</span>${esc(n.title || "Untitled thought")}</a>`
      : ""

  const body = `<article class="full">
<a class="back" href="../index.html">← Timeline</a>
<p class="eyebrow" style="margin-top:32px">${esc(formatLongDate(note.date))}</p>
<h1>${esc(note.title || "Untitled thought")}</h1>
<div class="meta">${purposesHtml(
    entryCategories(
      note.ownCategory,
      note.quotes.map((q) => q.category),
    ),
  )}</div>
<div class="body">${text}</div>
<nav class="neighbors" aria-label="Nearby entries">${neighbor(earlier, "prev", "← Earlier")}${neighbor(later, "next", "Later →")}</nav>
</article>`
  return shell({
    settings,
    title: `${note.title || "Untitled thought"} · ${settings.title}`,
    root: "../",
    current: null,
    hasThreads,
    body,
  })
}

function renderThreads(notes: PublishedNote[]) {
  const slugs = new Map(notes.map((n) => [n.id, n.slug]))
  const quotes: ThreadQuote[] = notes.flatMap((note) =>
    note.quotes.flatMap((q) => {
      const embedding = parseEmbedding(q.embedding)
      return embedding
        ? [
            {
              id: q.id,
              quote: q.quote,
              tags: splitList(q.tags),
              noteId: note.id,
              noteTitle: note.title,
              date: note.date,
              embedding,
            },
          ]
        : []
    }),
  )
  // "May 14, 2023"
  const fullDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  return buildThreads(quotes, THREAD_THRESHOLD).map(
    (thread) =>
      `<section class="thread"><ol>${thread.members
        .map((m, i) => {
          const gap =
            i > 0 ? describeGap(thread.members[i - 1].date, m.date) : null
          const when = `${fullDate(m.date)}${i > 0 && gap ? ` · ${gap} later` : ""}`
          return `<li><p class="when">${esc(when)}</p><a class="q" href="entries/${slugs.get(m.noteId)}.html#h-${m.id}">“${esc(
            m.quote,
          )}”</a><p class="from">from ${esc(m.noteTitle || "Untitled thought")}</p></li>`
        })
        .join("")}</ol></section>`,
  )
}

// Regenerate the whole public site from the entries marked as published.
// Unpublished entries are never read into the output.
export async function buildSite(input: Partial<SiteSettings>) {
  const settings: SiteSettings = {
    title: input.title?.trim() || DEFAULTS.title,
    description: input.description?.trim() || DEFAULTS.description,
    author: input.author?.trim() ?? "",
  }

  const raw = await loadPublished()
  const used = new Set<string>()
  const notes: PublishedNote[] = raw.map((note) => {
    const base = `${dayKey(note.date)}-${slugify(note.title) || "entry"}`
    let slug = base
    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`
    used.add(slug)
    return { ...note, slug }
  })

  const threads = renderThreads(notes)
  const hasThreads = threads.length > 0

  for (const item of GENERATED) {
    await rm(path.join(/*turbopackIgnore: true*/ PUBLISH_DIR, item), {
      recursive: true,
      force: true,
    })
  }
  await mkdir(path.join(/*turbopackIgnore: true*/ PUBLISH_DIR, "entries"), {
    recursive: true,
  })
  await mkdir(path.join(/*turbopackIgnore: true*/ PUBLISH_DIR, "assets"), {
    recursive: true,
  })

  const writes: [string, string][] = [
    [".nojekyll", ""],
    ["assets/site.css", SITE_CSS],
    ["assets/walker.js", WALKER_JS],
    ["index.html", renderIndex(notes, settings, hasThreads)],
  ]
  notes.forEach((note, i) => {
    // notes are newest first: the next item is earlier in time
    writes.push([
      `entries/${note.slug}.html`,
      renderEntry(note, notes[i + 1], notes[i - 1], settings, hasThreads),
    ])
  })
  if (hasThreads) {
    writes.push([
      "threads.html",
      shell({
        settings,
        title: `Threads · ${settings.title}`,
        root: "",
        current: "threads",
        hasThreads,
        body: `<div class="intro"><p class="eyebrow">Threads</p><h1>Watch a thought evolve</h1><p class="lede">Passages from different days that circle the same idea.</p></div>${threads.join("\n")}`,
      }),
    ])
  }

  const builtAt = new Date().toISOString()
  writes.push([
    "site.json",
    JSON.stringify({ ...settings, builtAt, entries: notes.length }, null, 2),
  ])
  for (const [file, content] of writes) {
    await writeFile(
      path.join(/*turbopackIgnore: true*/ PUBLISH_DIR, file),
      content,
    )
  }

  return {
    dir: PUBLISH_DIR,
    entries: notes.length,
    files: writes.length,
    builtAt,
  }
}
