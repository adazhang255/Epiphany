"use client"

import { SITE_TITLE } from "@/lib/site-mode"
import { usePublicView } from "@/components/usePublicView"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"
import { NOTEBOOK_TABS, STATS_TABS, TIMELINE_TABS } from "@/components/sections"
import { AnalysisIndicator } from "@/components/AnalysisIndicator"
import { ChartJobsIndicator } from "@/components/ChartJobsIndicator"

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
    href: "/export",
    label: "Export",
    // a page with an arrow leaving it
    icon: "M9 2.5H4.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8M8 8l5.5-5.5M10 2.5h3.5V6",
  },
  {
    href: "/publish",
    label: "Publish",
    // arrow out of a tray
    icon: "M8 9.5v-7M5 5.5l3-3 3 3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2",
  },
]

// wide enough for the side nav (Tailwind's lg); the top bar below that
const WIDE = "(min-width: 1024px)"
function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE)
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  )
}

function SectionIcon({
  section,
  size = 15,
}: {
  section: (typeof sections)[number]
  size?: number
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
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
  )
}

// On wide screens: a side nav down the left edge. The title, the reading
// sections with their tabs, then Write (and what's running in the
// background) at the foot. The tools sit top right (TopTools).
function SideNav({ wide }: { wide: boolean }) {
  const pathname = usePathname()
  const readOnly = usePublicView()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-white/5 bg-[#0f0f10] px-4 py-6 lg:flex">
      <Link href="/" className="px-2 font-serif text-2xl text-ink">
        {SITE_TITLE}
      </Link>

      <nav aria-label="Sections" className="mt-8 space-y-4">
        {sections.map((section) => {
          const active = section.tabs.some((tab) => tab.href === pathname)
          return (
            <div key={section.href}>
              <Link
                href={section.href}
                aria-current={
                  active && pathname === section.href ? "page" : undefined
                }
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[15px] font-medium transition ${
                  active
                    ? "bg-white/10 text-ink"
                    : "text-stone-400 hover:bg-white/5 hover:text-ink"
                }`}
              >
                <SectionIcon section={section} />
                {section.label}
              </Link>
              {section.tabs.length > 1 && (
                <ul className="ml-[1.05rem] mt-1 space-y-0.5 border-l border-white/10 pl-3">
                  {section.tabs.map((tab) => {
                    const here = pathname === tab.href
                    return (
                      <li key={tab.href}>
                        <Link
                          href={tab.href}
                          aria-current={here ? "page" : undefined}
                          className={`block rounded-md px-2 py-1 text-sm transition ${
                            here
                              ? "text-ember"
                              : "text-stone-500 hover:text-stone-200"
                          }`}
                        >
                          {tab.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3">
        {wide && (
          <div className="flex flex-col items-start gap-2 empty:hidden">
            <AnalysisIndicator />
            <ChartJobsIndicator />
          </div>
        )}
        {!readOnly && (
          <Link
            href="/write"
            className={`block rounded-full px-4 py-2 text-center text-sm font-medium transition ${
              pathname.startsWith("/write")
                ? "bg-white text-stone-900"
                : "bg-ink text-stone-900 hover:bg-white"
            }`}
          >
            Write
          </Link>
        )}
      </div>
    </aside>
  )
}

function ToolLink({ tool }: { tool: (typeof tools)[number] }) {
  const pathname = usePathname()
  const active = pathname.startsWith(tool.href)
  return (
    <Link
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
}

// On wide screens, beside the side nav: Import, Export and Publish at the
// top right of the page (they scroll away with it, so nothing sticky on the
// page is covered).
export function TopTools() {
  const readOnly = usePublicView()
  if (readOnly) return null
  return (
    <nav
      aria-label="Tools"
      className="mx-auto hidden h-16 w-full max-w-5xl items-center justify-end gap-1.5 px-4 sm:px-6 lg:flex"
    >
      {tools.map((tool) => (
        <ToolLink key={tool.href} tool={tool} />
      ))}
    </nav>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const readOnly = usePublicView()
  const wide = useWide()

  return (
    <>
      <SideNav wide={wide} />
      {/* narrower screens: a bar across the top */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0f0f10]/85 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0 font-serif text-xl text-ink">
            {SITE_TITLE}
          </Link>

          <span aria-hidden className="h-5 w-px shrink-0 bg-white/10" />

          {/* the reading sections on the left, beside the title; the tools
            and Write on the right */}
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
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
                    <SectionIcon section={section} />
                    {section.label}
                  </Link>
                )
              })}
            </nav>

            <nav
              aria-label="Tools"
              className="ml-auto flex items-center gap-1.5"
            >
              {(readOnly ? [] : tools).map((tool) => (
                <ToolLink key={tool.href} tool={tool} />
              ))}
            </nav>
          </div>

          {!wide && (
            <>
              <AnalysisIndicator />
              <ChartJobsIndicator />
            </>
          )}

          {!readOnly && (
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
          )}
        </div>
      </header>
    </>
  )
}
