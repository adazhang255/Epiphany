"use client"

import { SITE_TITLE } from "@/lib/site-mode"
import { usePublicView } from "@/components/usePublicView"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import {
  NOTEBOOK_TABS,
  STATS_TABS,
  THREADS_TABS,
  TIMELINE_TABS,
  QUOTES_TAB,
} from "@/components/sections"
import { useWriter } from "@/components/writeStatus"
import { SAVE_BUTTON } from "@/components/SaveCancel"
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
    href: "/threads",
    label: "Threads",
    tabs: THREADS_TABS,
    // two strands crossing and running on together
    icon: "M2 4.5c4.5 0 7.5 7 12 7M2 11.5c4.5 0 7.5-7 12-7",
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

// whether you've added Quotes (from the layout, which reads the setting):
// then it's a tab under Notebook (never on the public site)
const QuotesOn = createContext(false)
const withQuotes = (on: boolean) =>
  on
    ? sections.map((section) =>
        section.href === "/notebook"
          ? { ...section, tabs: [...section.tabs, QUOTES_TAB] }
          : section,
      )
    : sections
function useSections() {
  return withQuotes(useContext(QuotesOn))
}

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

// The reading sections, each with its tabs: down the side nav on wide
// screens, and in the menu on narrower ones.
function SectionLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const list = useSections()
  return (
    <nav aria-label="Sections" className="space-y-4">
      {list.map((section) => {
        const active = section.tabs.some((tab) => tab.href === pathname)
        return (
          <div key={section.href}>
            <Link
              href={section.href}
              onClick={onNavigate}
              aria-current={
                active && pathname === section.href ? "page" : undefined
              }
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[15px] font-medium transition pointer-coarse:py-2.5 ${
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
                        onClick={onNavigate}
                        aria-current={here ? "page" : undefined}
                        className={`block rounded-md px-2 py-1 text-sm transition pointer-coarse:py-2 ${
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
            {section.href === "/notebook" && (
              <AddQuotesLink onNavigate={onNavigate} />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// "+ Quotes", under Notebook: add the optional Quotes tab (until it's there)
function AddQuotesLink({ onNavigate }: { onNavigate?: () => void }) {
  const on = useContext(QuotesOn)
  const readOnly = usePublicView()
  const router = useRouter()
  const [error, setError] = useState("")
  if (on || readOnly) return null
  async function add() {
    setError("")
    const res = await fetch("/api/quotes/section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: true }),
    }).catch(() => null)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      return setError(data?.error ?? "Couldn't reach the app.")
    }
    onNavigate?.()
    router.push("/quotes")
    router.refresh()
  }
  return (
    <div className="ml-[1.05rem] mt-1 pl-3">
      <button
        type="button"
        onClick={add}
        title="Add a Quotes tab, for quotes you want to keep"
        className="px-2 text-xs text-stone-600 transition hover:text-stone-300 pointer-coarse:py-2"
      >
        + Quotes
      </button>
      {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
  )
}

// Write; while an entry is being written on the page (Write, or the
// notebook's blank page), Save for it, in reach at the top while you type
function WriteLink({ className }: { className: string }) {
  const pathname = usePathname()
  const writer = useWriter()
  const style = `rounded-full px-4 text-center text-sm font-medium transition ${className}`
  if (writer)
    return (
      <button
        type="button"
        onClick={writer.save}
        disabled={writer.status !== "idle"}
        className={`${SAVE_BUTTON} ${className} disabled:opacity-80`}
      >
        {writer.status === "saving"
          ? "Saving…"
          : writer.status === "saved"
            ? "Saved ✓"
            : "Save"}
      </button>
    )
  return (
    <Link
      href="/write"
      aria-current={pathname.startsWith("/write") ? "page" : undefined}
      className={`${style} ${
        pathname.startsWith("/write")
          ? "bg-white text-stone-900"
          : "bg-ink text-stone-900 hover:bg-white"
      }`}
    >
      Write
    </Link>
  )
}

// On wide screens: a side nav down the left edge. The title, the reading
// sections with their tabs, then Write (and what's running in the
// background) at the foot. The tools sit top right (TopTools).
function SideNav({ wide }: { wide: boolean }) {
  const readOnly = usePublicView()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col overflow-y-auto border-r border-white/5 bg-[#0f0f10] px-4 py-6 lg:flex">
      <Link href="/" className="px-2 font-serif text-2xl text-ink">
        {SITE_TITLE}
      </Link>

      <div className="mt-8">
        <SectionLinks />
      </div>

      <div className="mt-auto space-y-3 pt-6">
        {wide && (
          <div className="flex flex-col items-start gap-2 empty:hidden">
            <AnalysisIndicator />
            <ChartJobsIndicator />
          </div>
        )}
        {!readOnly && <WriteLink className="block py-2" />}
      </div>
    </aside>
  )
}

// Narrower screens: the side nav's contents in a drawer from the left,
// opened from the top bar. A modal <dialog>, so the page behind can't be
// reached while it's open, Escape closes it and the focus goes back to the
// menu button.
function MenuDrawer({
  open,
  onClose,
  opener,
}: {
  open: boolean
  onClose: () => void
  // the menu button, where the focus goes back to when it's shut without
  // going anywhere (a tap doesn't always leave the focus on it)
  opener: React.RefObject<HTMLButtonElement | null>
}) {
  const readOnly = usePublicView()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const dismiss = () => {
    onClose()
    requestAnimationFrame(() => opener.current?.focus())
  }

  return (
    <dialog
      ref={ref}
      id="site-menu"
      aria-label="Menu"
      onClose={onClose}
      onCancel={dismiss}
      // a tap on the dimmed page beside the drawer closes it
      onClick={(e) => e.target === e.currentTarget && dismiss()}
      className="nav-drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-r border-white/10 bg-[#0f0f10] p-0 text-stone-300 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex min-h-full flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            onClick={onClose}
            className="px-2 font-serif text-2xl text-ink"
          >
            {SITE_TITLE}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-full text-stone-400 hover:bg-white/10 hover:text-ink"
          >
            <svg
              aria-hidden
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
        </div>

        <div className="mt-6">
          <SectionLinks onNavigate={onClose} />
        </div>

        {!readOnly && (
          <nav
            aria-label="Tools"
            className="mt-8 flex flex-wrap gap-2 border-t border-white/10 pt-6"
          >
            {tools.map((tool) => (
              <ToolLink key={tool.href} tool={tool} onNavigate={onClose} />
            ))}
          </nav>
        )}

        {!readOnly && (
          <div className="mt-auto pt-8" onClick={onClose}>
            <WriteLink className="block py-2.5" />
          </div>
        )}
      </div>
    </dialog>
  )
}

function ToolLink({
  tool,
  onNavigate,
}: {
  tool: (typeof tools)[number]
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = pathname.startsWith(tool.href)
  return (
    <Link
      href={tool.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 pointer-coarse:py-2 font-mono text-[11px] uppercase tracking-widest transition ${
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

export function SiteHeader({ quotes = false }: { quotes?: boolean }) {
  const pathname = usePathname()
  const readOnly = usePublicView()
  const wide = useWide()
  const [menu, setMenu] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  // the drawer is only for narrow screens: shut it if the window widens,
  // and after a page change (a link in it, or Back)
  const [shownFor, setShownFor] = useState(pathname)
  if (shownFor !== pathname) {
    setShownFor(pathname)
    setMenu(false)
  }
  const menuOpen = menu && !wide

  // the section you're in, beside the title (the menu holds the rest)
  const here = withQuotes(quotes).find((section) =>
    section.tabs.some((tab) => tab.href === pathname),
  )

  return (
    <QuotesOn.Provider value={quotes}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-stone-900"
      >
        Skip to content
      </a>
      <SideNav wide={wide} />
      {/* narrower screens: a bar across the top, with the rest in a menu */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0f0f10]/85 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-2 sm:h-16 sm:gap-3 sm:px-4">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-300 transition hover:bg-white/10 hover:text-ink"
          >
            <svg
              aria-hidden
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
            </svg>
          </button>

          <Link href="/" className="shrink-0 font-serif text-xl text-ink">
            {SITE_TITLE}
          </Link>

          {here && (
            <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-stone-400">
              <span aria-hidden className="text-stone-600">
                /
              </span>
              <SectionIcon section={here} size={13} />
              <span className="truncate">{here.label}</span>
            </span>
          )}

          <span className="ml-auto flex shrink-0 items-center gap-2">
            {!wide && (
              <>
                <AnalysisIndicator />
                <ChartJobsIndicator />
              </>
            )}
            {!readOnly && <WriteLink className="shrink-0 py-2" />}
          </span>
        </div>
      </header>
      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenu(false)}
        opener={menuButton}
      />
    </QuotesOn.Provider>
  )
}
