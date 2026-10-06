import Link from "next/link"

// Search by topic: type what you're looking for in plain words. Entries that
// contain those words come first, then ones about it in meaning (found by
// the local embedding model). Other filters on the page are kept. Plain
// form, so it works without scripts.
export function TopicSearch({
  action,
  active,
  keep = {},
  clearHref,
}: {
  action: string
  active?: string
  // other query params to carry along (e.g. the type filter)
  keep?: Record<string, string | undefined>
  clearHref: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={action} role="search" className="flex items-center gap-2">
        {Object.entries(keep).map(([k, v]) =>
          v ? <input key={k} type="hidden" name={k} value={v} /> : null,
        )}
        <label className="flex items-center gap-1.5 rounded-full border border-white/10 py-1 pl-3 pr-1 text-sm text-stone-400 focus-within:border-white/30">
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="text-stone-500"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" />
          </svg>
          <input
            name="q"
            type="search"
            defaultValue={active ?? ""}
            placeholder="search a topic, e.g. money worries"
            aria-label="Search by topic"
            autoComplete="off"
            className="w-56 bg-transparent text-sm text-stone-100 outline-none placeholder:text-stone-600"
          />
          <button
            type="submit"
            className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-stone-200 hover:bg-white/20"
          >
            Search
          </button>
        </label>
      </form>
      {active && (
        <Link
          href={clearHref}
          className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm text-ink hover:bg-white/15"
          title="Clear the search"
        >
          “{active}” <span aria-hidden>×</span>
        </Link>
      )}
    </div>
  )
}
