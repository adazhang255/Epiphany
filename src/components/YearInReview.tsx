"use client"

import Link from "next/link"
import { useState } from "react"
import type { YearReview } from "@/features/insights/yearReview"
import { categoryColor, categoryGlyph } from "@/features/notes/lib/topics"

// One card per year: how much, when, what about, and how it felt.
export function YearInReview({ years }: { years: YearReview[] }) {
  const [year, setYear] = useState(years[0]?.year)
  const y = years.find((r) => r.year === year)
  if (!y) return null
  const tile = "rounded-xl border border-white/[0.07] p-4"
  const label = "text-xs text-stone-500"
  return (
    <section
      aria-labelledby="year-review-title"
      className="rounded-2xl border border-white/[0.07] bg-panel p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="year-review-title" className="font-serif text-xl text-ink">
          {y.year} in review
        </h2>
        {years.length > 1 && (
          <div className="flex gap-1">
            {years.map((r) => (
              <button
                key={r.year}
                type="button"
                onClick={() => setYear(r.year)}
                className={`rounded-md px-2.5 py-1 font-mono text-xs ${r.year === y.year ? "bg-white/10 text-ink" : "text-stone-500 hover:text-stone-200"}`}
              >
                {r.year}
              </button>
            ))}
          </div>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={tile}>
          <dt className={label}>Entries</dt>
          <dd className="mt-1 font-serif text-3xl text-ink">{y.entries}</dd>
        </div>
        <div className={tile}>
          <dt className={label}>Words</dt>
          <dd className="mt-1 font-serif text-3xl text-ink">
            {y.words.toLocaleString()}
          </dd>
        </div>
        <div className={tile}>
          <dt className={label}>Days written</dt>
          <dd className="mt-1 font-serif text-3xl text-ink">{y.days}</dd>
        </div>
        <div className={tile}>
          <dt className={label}>Busiest month</dt>
          <dd className="mt-1 font-serif text-xl text-ink">
            {y.busiestMonth ? (
              <>
                {y.busiestMonth.label}
                <span className="block font-sans text-xs text-stone-500">
                  {y.busiestMonth.entries}{" "}
                  {y.busiestMonth.entries === 1 ? "entry" : "entries"}
                </span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {y.idea && (
          <div className={`${tile} sm:col-span-2`}>
            <dt className={label}>The idea you kept returning to</dt>
            <dd className="mt-1 font-serif text-lg text-stone-100">
              {y.idea.title}
              <span className="ml-2 font-sans text-xs text-stone-500">
                {y.idea.passages} passages ·{" "}
                <Link
                  href="/threads"
                  className="underline hover:text-stone-300"
                >
                  threads
                </Link>
              </span>
            </dd>
          </div>
        )}
        {y.topWords.length > 0 && (
          <div className={tile}>
            <dt className={label}>Words you used most</dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {y.topWords.map((w, i) => (
                <span
                  key={w}
                  className="rounded-full border border-white/10 px-2.5 py-0.5 font-serif text-stone-200"
                  style={{ fontSize: `${17 - i}px` }}
                >
                  {w}
                </span>
              ))}
            </dd>
          </div>
        )}
        <div className={`${tile} space-y-3`}>
          {y.topType && (
            <div>
              <dt className={label}>Most kept</dt>
              <dd className="mt-0.5 flex items-center gap-2 text-stone-200">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: categoryColor(y.topType.name) }}
                />
                {categoryGlyph(y.topType.name)} {y.topType.name}
                <span className="text-xs text-stone-500">
                  {y.topType.count} highlights
                </span>
              </dd>
            </div>
          )}
          {y.tone && (
            <div>
              <dt className={label}>Overall tone</dt>
              <dd className="mt-0.5 text-stone-200">{y.tone}</dd>
            </div>
          )}
          {y.longest && (
            <div>
              <dt className={label}>Longest entry</dt>
              <dd className="mt-0.5">
                <Link
                  href={`/notes/${y.longest.id}`}
                  className="text-stone-200 underline decoration-stone-600 hover:text-ink"
                >
                  {y.longest.title}
                </Link>{" "}
                <span className="text-xs text-stone-500">
                  {y.longest.words.toLocaleString()} words
                </span>
              </dd>
            </div>
          )}
        </div>
      </dl>
    </section>
  )
}
