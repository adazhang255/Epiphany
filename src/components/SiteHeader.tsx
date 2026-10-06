"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { NOTEBOOK_TABS, STATS_TABS, TIMELINE_TABS } from "@/components/sections"
import { AnalysisIndicator } from "@/components/AnalysisIndicator"

// Places to read and explore; each has its own tabs inside.
const sections = [
  {
    href: "/",
    label: "Timeline",
    tabs: TIMELINE_TABS,
    // a spine with three moments on it
    icon: "M5 2.5v11M5 4.5h0M5 8h0M5 11.5h0M8 4.5h5M8 8h3.5M8 11.5h4.5",
  },
  {
    href: "/notebook",
    label: "Notebook",
    tabs: NOTEBOOK_TABS,
    // an open book
    icon: "M8 4.5c-1.5-1-3.5-1.5-5.5-1.5v9.5c2 0 4 .5 5.5 1.5 1.5-1 3.5-1.5 5.5-1.5V3c-2 0-4 .5-5.5 1.5zM8 4.5v9.5",
  },
  {
    href: "/stats",
    label: "Stats",
    tabs: STATS_TABS,
    // bar chart
    icon: "M2.5 13.5h11M4.5 13.5v-4M8 13.5v-8M11.5 13.5v-6",
  },
]

// Tools that move writing in or out, kept apart from the reading sections.
const tools = [
  {
    href: "/import",
    label: "Import",
    // arrow into a tray
    icon: "M8 2.5v7M5 6.5l3 3 3-3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2",
  },
  {
    href: "/publish",
    label: "Publish",
    // arrow out of a tray
    icon: "M8 9.5v-7M5 5.5l3-3 3 3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2",
  },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0f0f10]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="shrink-0 font-serif text-xl text-ink">
          Reflections
        </Link>

        <div className="no-scrollbar ml-auto flex min-w-0 items-center gap-3 overflow-x-auto">
          <nav aria-label="Sections" className="flex items-center gap-1">
            {sections.map((section) => {
              const active = section.tabs.some((tab) => tab.href === pathname)
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-white/10 text-ink"
                      : "text-stone-400 hover:text-ink"
                  }`}
                >
                  <svg
                    aria-hidden
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={section.href === "/" ? 1.6 : 1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={section.icon} />
                    {section.href === "/" && (
                      <g fill="currentColor" stroke="none">
                        <circle cx="5" cy="4.5" r="1.6" />
                        <circle cx="5" cy="8" r="1.6" />
                        <circle cx="5" cy="11.5" r="1.6" />
                      </g>
                    )}
                  </svg>
                  {section.label}
                </Link>
              )
            })}
          </nav>

          <span aria-hidden className="h-5 w-px shrink-0 bg-white/10" />

          <nav aria-label="Tools" className="flex items-center gap-1.5">
            {tools.map((tool) => {
              const active = pathname.startsWith(tool.href)
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest transition ${
                    active
                      ? "border-ember/60 bg-ember/10 text-ember"
                      : "border-dashed border-white/15 text-stone-400 hover:border-white/30 hover:text-stone-200"
                  }`}
                >
                  <svg
                    aria-hidden
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={tool.icon} />
                  </svg>
                  {tool.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <AnalysisIndicator />

        <Link
          href="/write"
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            pathname.startsWith("/write")
              ? "bg-white text-stone-900"
              : "bg-ink text-stone-900 hover:bg-white"
          }`}
        >
          Write
        </Link>
      </div>
    </header>
  )
}
