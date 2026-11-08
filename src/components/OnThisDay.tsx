import Link from "next/link"
import { PurposeBadges } from "@/components/PurposeBadges"
import { EntryTime } from "@/components/EntryTime"
import { entryCategories } from "@/features/notes/lib/topics"
import { EntryTitle } from "@/components/EntryTitle"
import { plainText } from "@/features/notes/lib/markdown"

type Memory = {
  id: string
  title: string
  date: Date
  createdAt: Date
  content: string
  ownCategory: string
  quotes: { id: string; quote: string; category: string }[]
}

function plural(n: number, unit: string) {
  return n === 1 ? `A ${unit} ago` : `${n} ${unit}s ago`
}

// What you wrote on this very date (same month and day) in past years.
export function OnThisDay({
  notes,
  today = new Date(),
  className = "mb-12",
  moreHref,
  showEmpty = false,
}: {
  notes: Memory[]
  today?: Date
  className?: string
  // link to the full On this day page
  moreHref?: string
  // say so when nothing matches, instead of showing nothing
  showEmpty?: boolean
}) {
  // by how many years ago, for entries on today's month and day only
  const byYears = new Map<number, Memory[]>()
  for (const note of notes) {
    const years = today.getFullYear() - note.date.getFullYear()
    if (
      years < 1 ||
      note.date.getMonth() !== today.getMonth() ||
      note.date.getDate() !== today.getDate()
    )
      continue
    byYears.set(years, [...(byYears.get(years) ?? []), note])
  }
  const groups = [...byYears.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([years, notes]) => ({ label: plural(years, "year"), notes }))

  if (groups.length === 0 && !showEmpty) return null

  return (
    <section
      aria-labelledby="on-this-day"
      className={`rounded-2xl border border-ember/20 bg-ember/[0.03] p-5 ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="on-this-day"
          className="font-mono text-xs uppercase tracking-[0.2em] text-ember/80"
        >
          On this day ·{" "}
          {today.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
        </h2>
        {moreHref && (
          <Link
            href={moreHref}
            className="text-sm text-stone-400 underline decoration-stone-600 hover:text-stone-200"
          >
            See every year →
          </Link>
        )}
      </div>
      {groups.length === 0 && (
        <p className="mt-3 text-sm text-stone-400">
          Nothing written on this day in past years.
        </p>
      )}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {groups.flatMap((group) =>
          group.notes.map((note) => {
            const quote = note.quotes[0]
            return (
              <li key={`${group.label}-${note.id}`}>
                <Link
                  href={
                    quote
                      ? `/notes/${note.id}?h=${quote.id}#h-${quote.id}`
                      : `/notes/${note.id}`
                  }
                  className="block h-full rounded-xl border border-white/[0.07] bg-panel p-4 transition hover:border-ember/40"
                >
                  <p className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-stone-500">
                    {group.label} ·{" "}
                    {note.date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    <EntryTime
                      date={note.date}
                      createdAt={note.createdAt}
                      before=" · "
                    />
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-serif text-lg text-stone-100">
                      <EntryTitle title={note.title} />
                    </span>
                    <PurposeBadges
                      purposes={entryCategories(
                        note.ownCategory,
                        note.quotes.map((q) => q.category),
                      )}
                    />
                  </div>
                  <p className="mt-2 line-clamp-3 font-serif text-[15px] leading-snug text-stone-300">
                    {quote ? `“${quote.quote}”` : plainText(note.content)}
                  </p>
                </Link>
              </li>
            )
          }),
        )}
      </ul>
    </section>
  )
}
