"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  STATS_TABS,
  TIMELINE_TABS,
  type SectionTab,
} from "@/components/sections"

function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label={label}
      className="flex gap-6 border-b border-white/10 pt-8"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium transition ${
              active
                ? "border-ember text-ink"
                : "border-transparent text-stone-500 hover:text-stone-200"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function TimelineTabs() {
  return <SectionTabs tabs={TIMELINE_TABS} label="Timeline views" />
}

export function StatsTabs() {
  return <SectionTabs tabs={STATS_TABS} label="Stats views" />
}
