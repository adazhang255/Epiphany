// Pages grouped under one top-level nav item, shown as tabs inside it.
export type SectionTab = { href: string; label: string }

export const TIMELINE_TABS: SectionTab[] = [
  { href: "/", label: "Highlights" },
  { href: "/threads", label: "Threads" },
]

export const NOTEBOOK_TABS: SectionTab[] = [
  { href: "/notebook", label: "Notebook" },
]

export const STATS_TABS: SectionTab[] = [
  { href: "/stats", label: "Overview" },
  { href: "/custom", label: "Custom" },
]

