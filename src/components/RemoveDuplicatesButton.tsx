"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { EntryTitle } from "@/components/EntryTitle"

export type DuplicateCopy = {
  id: string
  title: string
  date: string // ISO: the entry date it is filed under on the timeline
  published: boolean
  topics: string[]
  tags: string[]
  highlights: string[]
}

export type DuplicateGroup = {
  content: string // identical in every copy
  date: string // ISO
  copies: DuplicateCopy[] // the default copy to keep comes first
}

function entryDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// Shown only when duplicates exist. You can compare each group's copies side
// by side and pick which one stays; deleting asks for a second click.
function RemoveDuplicatesButtonInner({ groups }: { groups: DuplicateGroup[] }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [comparing, setComparing] = useState<number | null>(null)
  // group index -> id of the copy to keep
  const [keep, setKeep] = useState<Record<number, string>>(() =>
    Object.fromEntries(groups.map((g, i) => [i, g.copies[0].id])),
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  const total = groups.reduce((n, g) => n + g.copies.length - 1, 0)
  if (total === 0) return null

  async function remove() {
    setPending(true)
    setError("")
    const res = await fetch("/api/notes/dedupe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keep: Object.values(keep) }),
    }).catch(() => null)
    setPending(false)
    if (!res?.ok) {
      setError("Couldn’t remove them. Nothing was deleted.")
      return
    }
    setConfirming(false)
    router.refresh()
  }

  return (
    <div className="mb-8 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-stone-300">
          {total} duplicate {total === 1 ? "entry" : "entries"}: the same text
          saved more than once on the same date.
        </span>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-full border border-white/15 px-3 py-1 text-stone-200 transition hover:bg-white/5"
          >
            Review duplicates…
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 space-y-4 border-t border-white/5 pt-3">
          <ul className="space-y-3">
            {groups.map((group, i) => {
              const kept =
                group.copies.find((c) => c.id === keep[i]) ?? group.copies[0]
              const open = comparing === i
              return (
                <li key={group.copies[0].id} className="text-xs text-stone-400">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Keeps{" "}
                      <span className="text-stone-200">
                        “<EntryTitle title={kept.title} />”
                      </span>
                      , removes {group.copies.length - 1}{" "}
                      {group.copies.length === 2 ? "copy" : "copies"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setComparing(open ? null : i)}
                      aria-expanded={open}
                      className="text-stone-300 underline decoration-stone-600 hover:text-ink"
                    >
                      {open ? "Hide comparison" : "Compare side by side"}
                    </button>
                  </div>

                  {open && (
                    <div className="mt-3 space-y-3">
                      <details className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
                        <summary className="cursor-pointer text-stone-400">
                          The text every copy shares (
                          {group.content.split(/\s+/).length} words)
                        </summary>
                        <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-serif text-[14px] leading-relaxed text-stone-300">
                          {group.content}
                        </p>
                      </details>

                      {/* one column per copy; scrolls sideways when there are many */}
                      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                        {group.copies.map((copy) => {
                          const chosen = copy.id === kept.id
                          return (
                            <label
                              key={copy.id}
                              className={`flex w-64 shrink-0 snap-start cursor-pointer flex-col gap-2 rounded-lg border p-3 transition ${
                                chosen
                                  ? "border-ember/60 bg-ember/[0.06]"
                                  : "border-white/10 hover:border-white/25"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`keep-${i}`}
                                  checked={chosen}
                                  onChange={() =>
                                    setKeep({ ...keep, [i]: copy.id })
                                  }
                                  className="accent-[#e8c27a]"
                                />
                                <span
                                  className={
                                    chosen ? "text-ember" : "text-stone-500"
                                  }
                                >
                                  {chosen ? "Keep this one" : "Remove"}
                                </span>
                              </span>
                              <span className="font-serif text-base text-stone-100">
                                <EntryTitle title={copy.title} />
                              </span>
                              <span className="text-stone-500">
                                Filed under {entryDate(copy.date)}
                                {copy.published && " · Public"}
                              </span>
                              <span className="mt-1 text-stone-500">
                                {copy.highlights.length} highlights
                              </span>
                              <ul className="space-y-1.5">
                                {copy.highlights.map((h, j) => (
                                  <li
                                    key={j}
                                    className="line-clamp-3 font-serif text-[13px] leading-snug text-stone-300"
                                  >
                                    “{h}”
                                  </li>
                                ))}
                              </ul>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <p className="text-xs text-stone-500">
            By default the copy with the most highlights is kept. Removed copies
            and their highlights are deleted permanently.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-full bg-rose-300/90 px-4 py-1.5 text-sm font-medium text-stone-900 disabled:opacity-60"
            >
              {pending ? "Removing…" : `Remove ${total}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-stone-400 hover:text-stone-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-300/80">{error}</p>}
    </div>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function RemoveDuplicatesButton(
  props: React.ComponentProps<typeof RemoveDuplicatesButtonInner>,
) {
  return usePublicView() ? null : <RemoveDuplicatesButtonInner {...props} />
}
