import Link from "next/link"
import { PurposeBadges } from "@/components/PurposeBadges"
import { prisma } from "@/lib/prisma"
import { entryCategories } from "@/features/notes/lib/topics"

export const dynamic = "force-dynamic"

// How far from the exact day an entry still counts as "around this day".
const WINDOW_DAYS = 3
const DAY = 24 * 60 * 60 * 1000

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

// ?date=YYYY-MM-DD (only its month and day matter); defaults to today
function pickDay(value: string | undefined) {
  const today = new Date()
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m)
    return new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return new Date(today.getFullYear(), Number(m[2]) - 1, Number(m[3]))
}

function yearsAgo(n: number) {
  if (n === 0) return "This year"
  return n === 1 ? "A year ago" : `${n} years ago`
}

// Everything written on this calendar day in every year, newest first. A
// year with nothing on the day itself shows what's within a few days of it.
export default async function OnThisDayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date } = await searchParams
  const day = pickDay(date)
  const thisYear = new Date().getFullYear()

  const notes = await prisma.note.findMany({
    orderBy: { date: "asc" },
    select: {
      id: true,
      title: true,
      date: true,
      content: true,
      tags: true,
      ownCategory: true,
      autoTags: true,
      quotes: {
        select: { id: true, quote: true, category: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  const years = [...new Set(notes.map((n) => n.date.getFullYear()))].sort(
    (a, b) => b - a,
  )
  const groups = years
    .map((year) => {
      const target = new Date(year, day.getMonth(), day.getDate())
      const near = notes
        .map((n) => ({
          note: n,
          offset: Math.round(
            (new Date(
              n.date.getFullYear(),
              n.date.getMonth(),
              n.date.getDate(),
            ).getTime() -
              target.getTime()) /
              DAY,
          ),
        }))
        .filter((m) => Math.abs(m.offset) <= WINDOW_DAYS)
      const exact = near.filter((m) => m.offset === 0)
      return {
        year,
        exact: exact.length > 0,
        // the day itself if anything was written then, else the days around it
        matches: (exact.length ? exact : near).sort(
          (a, b) => Math.abs(a.offset) - Math.abs(b.offset),
        ),
      }
    })
    .filter((g) => g.matches.length > 0)

  const prev = new Date(day.getTime() - DAY)
  const next = new Date(day.getTime() + DAY)
  const label = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric" })
  const isToday = iso(day) === iso(new Date())

  // the nearest calendar days (any year) that have something, to jump to
  const writtenDays = [
    ...new Set(
      notes.map((n) =>
        iso(new Date(thisYear, n.date.getMonth(), n.date.getDate())),
      ),
    ),
  ].sort()
  const later = writtenDays.find((d) => d > iso(day)) ?? writtenDays[0]
  const earlier =
    [...writtenDays].reverse().find((d) => d < iso(day)) ?? writtenDays.at(-1)

  const chip =
    "rounded-full border border-white/10 px-3 py-1 text-sm text-stone-400 transition hover:border-white/25 hover:text-stone-200"

  return (
    <div>
      <Link
        href="/stats"
        className="mt-8 inline-block font-mono text-xs uppercase tracking-widest text-stone-500 hover:text-stone-200"
      >
        ← Stats
      </Link>
      <div className="mx-auto max-w-3xl pt-10">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            On this day
          </p>
          <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
            {label(day)}
          </h1>
          <p className="mt-3 text-stone-400">
            {groups.length === 0
              ? `Nothing written within ${WINDOW_DAYS} days of ${label(day)}, in any year.`
              : `You wrote on or around ${label(day)} in ${groups.length === 1 ? "one year" : `${groups.length} different years`}.`}
          </p>
        </header>

        <nav
          aria-label="Choose a day"
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          <Link href={`/on-this-day?date=${iso(prev)}`} className={chip}>
            ← {label(prev)}
          </Link>
          {!isToday && (
            <Link href="/on-this-day" className={chip}>
              Today
            </Link>
          )}
          <Link href={`/on-this-day?date=${iso(next)}`} className={chip}>
            {label(next)} →
          </Link>
          <form action="/on-this-day" className="ml-auto flex gap-2">
            <input
              type="date"
              name="date"
              defaultValue={iso(day)}
              aria-label="Pick a day"
              className="rounded-full border border-white/10 bg-transparent px-3 py-1 font-mono text-xs text-stone-300 [color-scheme:dark]"
            />
            <button type="submit" className={chip}>
              Go
            </button>
          </form>
        </nav>

        {groups.length === 0 && writtenDays.length > 0 && (
          <p className="mt-8 text-sm text-stone-500">
            Nearest days with writing:{" "}
            {earlier && (
              <Link
                href={`/on-this-day?date=${earlier}`}
                className="text-ember hover:underline"
              >
                ← {label(new Date(`${earlier}T12:00`))}
              </Link>
            )}
            {earlier && later && " · "}
            {later && (
              <Link
                href={`/on-this-day?date=${later}`}
                className="text-ember hover:underline"
              >
                {label(new Date(`${later}T12:00`))} →
              </Link>
            )}
          </p>
        )}

        <ol className="mt-10 space-y-10">
          {groups.map((group) => (
            <li key={group.year}>
              <h2 className="flex items-baseline gap-3 border-b border-white/10 pb-2">
                <span className="font-serif text-2xl text-ink">
                  {group.year}
                </span>
                <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
                  {yearsAgo(thisYear - group.year)}
                  {!group.exact && " · around this day"}
                </span>
              </h2>
              <ul className="mt-4 space-y-4">
                {group.matches.map(({ note, offset }) => {
                  const quote = note.quotes[0]
                  return (
                    <li key={note.id}>
                      <Link
                        href={
                          quote
                            ? `/notes/${note.id}?h=${quote.id}#h-${quote.id}`
                            : `/notes/${note.id}`
                        }
                        className="block rounded-xl border border-white/[0.07] bg-panel p-4 transition hover:border-ember/40"
                      >
                        <p className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
                          {note.date.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                          {offset !== 0 &&
                            ` · ${Math.abs(offset)} ${Math.abs(offset) === 1 ? "day" : "days"} ${offset < 0 ? "before" : "after"}`}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="font-serif text-lg text-stone-100">
                            {note.title || "Untitled thought"}
                          </span>
                          <PurposeBadges
                            purposes={entryCategories(
                              note.ownCategory,
                              note.quotes.map((q) => q.category),
                            )}
                          />
                        </div>
                        <p className="mt-2 line-clamp-4 whitespace-pre-wrap font-serif text-[15px] leading-snug text-stone-300">
                          {quote ? `“${quote.quote}”` : note.content}
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
