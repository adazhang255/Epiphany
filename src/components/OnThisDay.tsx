import Link from "next/link"
import { PurposeBadges } from "@/components/PurposeBadges"
import { dayKey } from "@/features/notes/lib/time"
import { entryCategories } from "@/features/notes/lib/topics"
import { EntryTitle } from "@/components/EntryTitle"

type Memory = {
  id: string
  title: string
  date: Date
  content: string
  ownCategory: string
  quotes: { id: string; quote: string; category: string }[]
}

// How far a month/year match may drift from the exact date ("around this day").
const WINDOW_DAYS = 3

function shift(date: Date, { days = 0, months = 0, years = 0 }) {
  return new Date(
    date.getFullYear() - years,
    date.getMonth() - months,
    date.getDate() - days,
  )
}

function plural(n: number, unit: string) {
  return n === 1 ? `A ${unit} ago` : `${n} ${unit}s ago`
}

// What you wrote a week ago, a month ago, and on this date in past years.
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
  const byDay = new Map<string, Memory[]>()
  for (const note of notes) {
    const key = dayKey(note.date)
    byDay.set(key, [...(byDay.get(key) ?? []), note])
  }

  const groups: { label: string; notes: Memory[] }[] = []
  const add = (label: string, target: Date) => {
    const found = byDay.get(dayKey(target))
    if (found) groups.push({ label, notes: found })
    return Boolean(found)
  }

  // exact date first, then the closest entry within a few days either side
  const addNear = (exact: string, around: string, target: Date) => {
    if (add(exact, target)) return
    for (let d = 1; d <= WINDOW_DAYS; d++) {
      if (add(around, shift(target, { days: d }))) return
      if (add(around, shift(target, { days: -d }))) return
    }
  }

  add("A week ago", shift(today, { days: 7 }))
  addNear("A month ago", "About a month ago", shift(today, { months: 1 }))
  const oldest = Math.min(...notes.map((n) => n.date.getFullYear()))
  for (let years = 1; today.getFullYear() - years >= oldest; years++) {
    const label = plural(years, "year")
    addNear(
      label,
      `Around this day, ${label.toLowerCase()}`,
      shift(today, { years }),
    )
  }

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
          Nothing from a week ago, a month ago, or this day in past years.
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
                    {quote ? `“${quote.quote}”` : note.content}
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
