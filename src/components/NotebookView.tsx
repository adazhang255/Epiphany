"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { useTopicSearch } from "@/components/useTopicSearch"
import { PUBLIC_SITE } from "@/lib/site-mode"
import type { NotebookNote } from "@/features/notes/services/notes.service"
import type { TrackerView } from "@/features/trackers/trackers"
import { NotebookFeed } from "@/components/NotebookFeed"
import { TopicSearch } from "@/components/TopicSearch"
import { categoryColor, categoryGlyph } from "@/features/notes/lib/topics"
import { ExportDocsButton } from "@/components/ExportDocsButton"

export type NotebookFacets = {
  total: number
  uncategorized: number
  starred: number
  categories: { name: string; count: number }[]
}

// The notebook, filtered in the browser from ?filter, ?category and ?q (the
// page loads every entry once).
export function NotebookView({
  notes: all,
  facets,
  custom,
  trackers = [],
}: {
  notes: NotebookNote[]
  facets: NotebookFacets
  custom: string[]
  trackers?: TrackerView[]
}) {
  const params = useSearchParams()
  const asked = params.get("filter")
  const filter =
    asked === "uncategorized" || (asked === "starred" && !PUBLIC_SITE)
      ? asked
      : "all"
  const q = params.get("q")?.trim() || undefined
  // a category filter only counts if it's one in use (any case)
  const category =
    filter === "all"
      ? facets.categories.find(
          (c) => c.name.toLowerCase() === params.get("category")?.toLowerCase(),
        )?.name
      : undefined
  const inView = all.filter(
    (n) =>
      (filter !== "uncategorized" || n.purposes.length === 0) &&
      (filter !== "starred" || n.starred) &&
      (!category || n.purposes.includes(category)),
  )
  // a search keeps its own order: most relevant first
  const searchable = useMemo(
    () => all.map((n) => ({ ...n, quotes: n.highlights })),
    [all],
  )
  const found = useTopicSearch(q, searchable)
  const rank = new Map(found?.noteIds.map((id, i) => [id, i]))
  const notes = found
    ? inView
        .filter((n) => rank.has(n.id))
        .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
    : inView
  const first = {
    count: notes.length,
    byMeaning: found?.byMeaning ?? true,
  }
  // links that change one filter and keep the others
  const href = (next: {
    filter?: string | null
    category?: string | null
    q?: string | null
  }) => {
    const query = new URLSearchParams()
    const f = next.filter === undefined ? filter : next.filter
    const c = next.category === undefined ? category : next.category
    const t = next.q === undefined ? q : next.q
    if (f === "uncategorized" || f === "starred") query.set("filter", f)
    else if (c) query.set("category", c.toLowerCase())
    if (t) query.set("q", t)
    const s = query.toString()
    return s ? `/notebook?${s}` : "/notebook"
  }

  const chip = (active: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
      active
        ? "border-white/30 bg-white/10 text-ink"
        : "border-white/10 text-stone-400 hover:text-stone-200"
    }`
  const filtered = filter !== "all" || category || q

  return (
    <div className="mx-auto max-w-3xl pt-12">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Notebook
        </p>
        <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
          {filter === "uncategorized"
            ? "Nothing to hold onto?"
            : filter === "starred"
              ? "Your favourites"
              : "Every page, in full"}
        </h1>
        <p className="mt-3 text-stone-400">
          {filter === "uncategorized"
            ? "Entries with no category yet: no highlights to take one from, and none chosen. Give each one a category at the foot of its page (it saves straight away), open it to find highlights, or delete what you don't need."
            : filter === "starred" && !q
              ? notes.length
                ? `${notes.length} starred ${notes.length === 1 ? "entry" : "entries"}, newest first. Star a page (☆ by its title) to keep it here.`
                : "Nothing starred yet. Star a page (☆ by its title) to keep it here."
              : filtered
              ? q
                ? found?.loading
                  ? "Searching…"
                  : PUBLIC_SITE
                    ? `${first.count} of ${facets.total} entries${category ? ` in ${category}` : ""} about “${q}”, by their words.`
                    : `${first.count} of ${facets.total} entries${category ? ` in ${category}` : ""} about “${q}”, most relevant first: ones using your words, then ones close in meaning.${first.byMeaning ? "" : " (Matching by meaning is off: Ollama isn't running, so only exact words were matched.)"}`
                : `${first.count} of ${facets.total} entries${category ? ` in ${category}` : ""}, newest first. Click a page to open it${PUBLIC_SITE ? "" : " and edit"}.`
              : `${facets.total} ${facets.total === 1 ? "entry" : "entries"}, newest first. Keep scrolling to turn back through the notebook; click a page to open it${PUBLIC_SITE ? "" : " and edit"}.`}
        </p>
        {/* what's shown: the whole journal, or the entries filtered here */}
        <ExportDocsButton
          className="mt-4"
          ids={filtered ? notes.map((n) => n.id) : undefined}
          label={
            filtered
              ? `Export these ${notes.length} to Google Docs`
              : "Export to Google Docs"
          }
        />
      </header>

      <div className="mb-10 space-y-3">
        {/* filter by category */}
        <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
          <Link
            href={href({ filter: null, category: null })}
            aria-current={filter === "all" && !category ? "page" : undefined}
            className={chip(filter === "all" && !category)}
          >
            All
            <span className="font-mono text-xs text-stone-500">
              {facets.total}
            </span>
          </Link>
          {facets.categories.map((c) => (
            <Link
              key={c.name}
              href={href({ filter: null, category: c.name })}
              aria-current={category === c.name ? "page" : undefined}
              className={chip(category === c.name)}
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: categoryColor(c.name) }}
              />
              {categoryGlyph(c.name)} {c.name}
              <span className="font-mono text-xs text-stone-500">
                {c.count}
              </span>
            </Link>
          ))}
          {!PUBLIC_SITE && (
            <Link
              href={href({ filter: "starred", category: null })}
              aria-current={filter === "starred" ? "page" : undefined}
              className={chip(filter === "starred")}
            >
              <span aria-hidden className="text-ember">
                ★
              </span>
              Starred
              <span className="font-mono text-xs text-stone-500">
                {facets.starred}
              </span>
            </Link>
          )}
          <Link
            href={href({ filter: "uncategorized", category: null })}
            aria-current={filter === "uncategorized" ? "page" : undefined}
            className={chip(filter === "uncategorized")}
          >
            Uncategorized
            <span className="font-mono text-xs text-stone-500">
              {facets.uncategorized}
            </span>
          </Link>
        </nav>
        {/* search by topic */}
        <TopicSearch
          action="/notebook"
          active={q}
          keep={{
            filter: filter === "all" ? undefined : filter,
            category: category?.toLowerCase(),
          }}
          clearHref={href({ q: null })}
        />
      </div>

      {filtered && first.count === 0 ? (
        <p className="text-stone-400">
          No entries match.{" "}
          <Link href="/notebook" className="text-ember hover:underline">
            Show all
          </Link>
        </p>
      ) : (
        <NotebookFeed
          key={`${filter}-${category ?? ""}-${q ?? ""}`}
          notes={notes}
          filter={filter}
          category={category}
          q={q}
          custom={custom}
          trackers={trackers}
        />
      )}
    </div>
  )
}
