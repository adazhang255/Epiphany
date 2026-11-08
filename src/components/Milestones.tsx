import type { Milestone } from "@/features/insights/milestones"

// What you reached lately, as a few plain lines (nothing when there's
// nothing new).
export function Milestones({ list }: { list: Milestone[] }) {
  if (list.length === 0) return null
  return (
    <section aria-labelledby="milestones-title">
      <h2
        id="milestones-title"
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-500"
      >
        Lately
      </h2>
      <ul className="mt-2 divide-y divide-white/[0.05] border-y border-white/[0.05]">
        {list.map((m) => (
          <li
            key={m.id}
            className="flex items-baseline justify-between gap-4 py-2 text-sm"
          >
            <span className="text-stone-300">{m.text}</span>
            <time
              dateTime={m.day}
              className="shrink-0 font-mono text-[11px] text-stone-600"
            >
              {new Date(`${m.day}T12:00:00`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </time>
          </li>
        ))}
      </ul>
    </section>
  )
}
