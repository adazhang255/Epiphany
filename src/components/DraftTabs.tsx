"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  draftName,
  newDraftId,
  useNewEntryDrafts,
  writeHref,
} from "@/components/useDraft"

// Your drafts on the go, above the Write page (or the notebook's blank
// page): switch between them, or start another. (Each is kept as you type;
// switching loses nothing.) With `onPick`, switching stays on the page
// instead of going to the draft's own Write page.
export function DraftTabs({
  current,
  onPick,
  className = "mb-6",
}: {
  current: string
  onPick?: (id: string) => void
  className?: string
}) {
  const router = useRouter()
  const drafts = useNewEntryDrafts()
  const here = drafts.find((d) => d.id === current)
  // the one open, even before anything's written in it
  const list = here ? drafts : [...drafts, { id: current, draft: null }]
  // nothing to switch between yet
  if (list.length < 2 && !here) return null

  return (
    <nav
      aria-label="Drafts"
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
    >
      {list.map(({ id, draft }) => {
        const open = id === current
        const className = `max-w-[14rem] truncate rounded-full px-3 py-1.5 text-sm transition pointer-coarse:py-2 ${
          open
            ? "bg-white/10 text-ink ring-1 ring-white/20"
            : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
        }`
        return onPick ? (
          <button
            key={id || "first"}
            type="button"
            aria-pressed={open}
            onClick={() => onPick(id)}
            className={className}
          >
            {draftName(draft)}
          </button>
        ) : (
          <Link
            key={id || "first"}
            href={writeHref(id)}
            aria-current={open ? "page" : undefined}
            className={className}
          >
            {draftName(draft)}
          </Link>
        )
      })}
      <button
        type="button"
        // a blank one is already open
        disabled={!here}
        title={here ? undefined : "This one's still blank"}
        onClick={() => {
          const id = newDraftId()
          if (onPick) onPick(id)
          else router.push(writeHref(id))
        }}
        className="rounded-full px-3 py-1.5 text-sm text-ember transition hover:bg-white/5 disabled:text-stone-600 disabled:hover:bg-transparent pointer-coarse:py-2"
      >
        + New draft
      </button>
    </nav>
  )
}
