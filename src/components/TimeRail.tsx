"use client"

import { useEffect, useState } from "react"

export type RailMonth = {
  key: string
  label: string
  year: number
  highlights: number
}

// Month index for the timeline: a sticky sidebar on desktop, a chip strip on
// mobile. Bar length shows how much was highlighted that month.
export function TimeRail({ months }: { months: RailMonth[] }) {
  const [active, setActive] = useState(months[0]?.key)
  const max = Math.max(1, ...months.map((m) => m.highlights))

  useEffect(() => {
    const sections = months
      .map((m) => document.getElementById(`m-${m.key}`))
      .filter((el): el is HTMLElement => el !== null)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          setActive(visible[0].target.id.slice(2))
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    )
    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [months])

  useEffect(() => {
    document
      .getElementById(`chip-${active}`)
      ?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [active])

  const years = Array.from(new Set(months.map((m) => m.year)))

  return (
    <>
      <nav
        aria-label="Jump to month"
        className="sticky top-24 hidden max-h-[calc(100vh-8rem)] self-start overflow-y-auto pr-2 lg:block"
      >
        {years.map((year) => (
          <div key={year} className="mb-5">
            <p className="mb-2 font-mono text-xs tracking-widest text-muted">
              {year}
            </p>
            <ul className="space-y-0.5">
              {months
                .filter((m) => m.year === year)
                .map((m) => (
                  <li key={m.key}>
                    <a
                      href={`#m-${m.key}`}
                      className={`group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition ${
                        active === m.key
                          ? "bg-white/[0.06] text-ink"
                          : "text-stone-500 hover:text-stone-200"
                      }`}
                    >
                      <span className="w-16 shrink-0">
                        {m.label.slice(0, 3)}
                      </span>
                      <span className="h-1 flex-1 rounded-full bg-white/5">
                        <span
                          className={`block h-1 rounded-full ${active === m.key ? "bg-ember" : "bg-stone-600 group-hover:bg-stone-400"}`}
                          style={{
                            width: `${Math.max(8, (m.highlights / max) * 100)}%`,
                          }}
                        />
                      </span>
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <nav
        aria-label="Jump to month"
        className="no-scrollbar sticky top-16 z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-white/5 bg-[#0f0f10]/90 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden"
      >
        {months.map((m) => (
          <a
            key={m.key}
            id={`chip-${m.key}`}
            href={`#m-${m.key}`}
            className={`shrink-0 rounded-full border px-3 py-1 font-mono text-xs transition ${
              active === m.key
                ? "border-ember/60 bg-ember/10 text-ink"
                : "border-white/10 text-stone-400"
            }`}
          >
            {m.label.slice(0, 3)} {String(m.year).slice(2)}
          </a>
        ))}
      </nav>
    </>
  )
}
