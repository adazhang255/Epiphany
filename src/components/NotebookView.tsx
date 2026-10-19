"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { useTopicSearch } from "@/components/useTopicSearch"
import { PUBLIC_SITE } from "@/lib/site-mode"
import type { NotebookNote } from "@/features/notes/services/notes.service"
import { NotebookFeed } from "@/components/NotebookFeed"
import { TopicSearch } from "@/components/TopicSearch"
import { categoryColor, categoryGlyph } from "@/features/notes/lib/topics"

export type NotebookFacets = {
  total: number
  uncategorized: number
  categories: { name: string; count: number }[]
}

// The notebook, filtered in the browser from ?filter, ?category and ?q (the
// page loads every entry once).
export function NotebookView({
  notes: all,
  facets,
  custom,
}: {
  notes: NotebookNote[]
  facets: NotebookFacets
  custom: string[]
}) {
  const params = useSearchParams()
  const filter =
    params.get("filter") === "uncategorized" ? "uncategorized" : "all"
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
    if (f === "uncategorized") query.set("filter", f)
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
  const filtered = filter === "uncategorized" || category || q

  return (
    <div className="mx-auto max-w-3xl pt-12">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Notebook
        </p>
        <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
          {filter === "uncategorized"
            ? "Nothing to hold onto?"
            : "Every page, in full"}
        </h1>
        <p className="mt-3 text-stone-400">
          {filter === "uncategorized"
            ? "Entries with no category yet: no highlights to take one from, and none chosen. Give each one a category at the foot of its page (it saves straight away), open it to find highlights, or delete what you don't need."
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
            filter: filter === "uncategorized" ? filter : undefined,
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
        />
      )}
    </div>
  )
}
