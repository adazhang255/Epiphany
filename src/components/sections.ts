import { PUBLIC_SITE } from "@/lib/site-mode"

// Pages grouped under one top-level nav item, shown as tabs inside it.
export type SectionTab = { href: string; label: string }

export const TIMELINE_TABS: SectionTab[] = [{ href: "/", label: "Highlights" }]

export const THREADS_TABS: SectionTab[] = [
  { href: "/threads", label: "Threads" },
]

export const NOTEBOOK_TABS: SectionTab[] = [
  { href: "/notebook", label: "Notebook" },
]

export const STATS_TABS: SectionTab[] = [
  { href: "/stats", label: "Overview" },
  // your own day-by-day answers: never on the public site
  ...(PUBLIC_SITE ? [] : [{ href: "/trackers", label: "Trackers" }]),
  { href: "/custom", label: "Custom" },
]
