"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { SiteInfo } from "@/features/publish/buildSite"
import { EntryTitle } from "@/components/EntryTitle"
import { titleText } from "@/features/notes/lib/titles"

export type PublishRow = {
  id: string
  title: string
  date: string // ISO
  highlights: number
  published: boolean
  // its highlights, each of which can be shared on its own
  passages: {
    id: string
    quote: string
    category: string
    published: boolean
  }[]
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export type SiteDiff = {
  pushedBefore: boolean
  added: string[]
  changed: string[]
  removed: string[]
}

export function PublishManager({
  rows,
  site,
  dir,
  diff,
}: {
  rows: PublishRow[]
  site: SiteInfo
  dir: string
  // the last build against what's online (as of the last push)
  diff: SiteDiff
}) {
  const router = useRouter()
  const [published, setPublished] = useState(
    () => new Set(rows.filter((r) => r.published).map((r) => r.id)),
  )
  const [settings, setSettings] = useState({
    title: site.title,
    description: site.description,
    author: site.author,
  })
  const [status, setStatus] = useState("")
  const [building, setBuilding] = useState(false)
  // the entry being read in full, as its public page
  const [reading, setReading] = useState<number | null>(null)

  // passages shared by themselves (their entry stays private)
  const [shared, setShared] = useState(
    () =>
      new Set(
        rows.flatMap((r) =>
          r.passages.filter((p) => p.published).map((p) => p.id),
        ),
      ),
  )
  const [openRow, setOpenRow] = useState<string | null>(null)
  async function sharePassage(id: string, value: boolean) {
    setShared((prev) => {
      const next = new Set(prev)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })
    const res = await fetch(`/api/highlights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: value }),
    }).catch(() => null)
    if (!res?.ok) setStatus("Could not save that change.")
  }

  async function toggle(id: string, value: boolean) {
    setPublished((prev) => {
      const next = new Set(prev)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: value }),
    })
    if (!res.ok) setStatus("Could not save that change.")
  }

  // make every entry public, or every one private (only those that change)
  async function setAll(value: boolean) {
    const ids = rows
      .filter((r) => published.has(r.id) !== value)
      .map((r) => r.id)
    if (ids.length === 0) return
    setPublished(value ? new Set(rows.map((r) => r.id)) : new Set())
    setStatus("")
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: value }),
        })
          .then((r) => r.ok)
          .catch(() => false),
      ),
    )
    const failed = ids.filter((_, i) => !results[i])
    if (failed.length) {
      // show what was actually saved
      setPublished((prev) => {
        const next = new Set(prev)
        for (const id of failed) {
          if (value) next.delete(id)
          else next.add(id)
        }
        return next
      })
      setStatus(
        `Couldn't save ${failed.length} of ${ids.length} changes. Try again.`,
      )
    }
  }

  async function build() {
    setBuilding(true)
    setStatus("")
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }).catch(() => null)
    const body = await res?.json().catch(() => null)
    setBuilding(false)
    if (!res?.ok) {
      setStatus(body?.error ?? "Build failed.")
      return
    }
    setStatus(
      `Built ${body.entries} ${body.entries === 1 ? "entry" : "entries"} into ${body.dir}.`,
    )
    router.refresh()
  }

  const input =
    "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-stone-100 outline-none focus:border-white/30"

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Entries
          </h2>
          <span className="flex items-center gap-3 text-xs text-stone-500">
            {published.size} of {rows.length} public
            {shared.size > 0 &&
              ` · ${shared.size} ${shared.size === 1 ? "passage" : "passages"} on ${shared.size === 1 ? "its" : "their"} own`}
            <button
              type="button"
              onClick={() => setAll(true)}
              disabled={published.size === rows.length}
              className="text-stone-300 underline decoration-stone-600 hover:text-ink disabled:no-underline disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              disabled={published.size === 0}
              className="text-stone-300 underline decoration-stone-600 hover:text-ink disabled:no-underline disabled:opacity-40"
            >
              Select none
            </button>
          </span>
        </div>
        <ul className="divide-y divide-white/5 rounded-xl border border-white/[0.07]">
          {rows.map((row, i) => {
            const on = published.has(row.id)
            return (
              <li
                key={row.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-white/[0.02] ${
                  reading !== null && rows[reading].id === row.id
                    ? "bg-white/[0.04]"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => toggle(row.id, e.target.checked)}
                  aria-label={`Make “${titleText(row.title)}” public`}
                  className="h-4 w-4 cursor-pointer accent-[#e8c27a]"
                />
                {/* the entry itself: read it in full, as it would look */}
                <button
                  type="button"
                  onClick={() => setReading(i)}
                  title="Read it as it would look on your site"
                  className="group/read min-w-0 flex-1 text-left"
                >
                  <span
                    className={`block truncate group-hover/read:underline ${on ? "text-ink" : "text-stone-300"}`}
                  >
                    <EntryTitle title={row.title} />
                  </span>
                  <span className="text-xs text-stone-500">
                    {shortDate(row.date)} · {row.highlights} highlights ·{" "}
                    <span className="text-stone-400 group-hover/read:text-ember">
                      Preview
                    </span>
                  </span>
                </button>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                    on ? "bg-ember/15 text-ember" : "text-stone-600"
                  }`}
                >
                  {on ? "Public" : "Private"}
                </span>
                {/* share single passages of an entry that stays private */}
                {row.passages.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenRow((o) => (o === row.id ? null : row.id))
                    }
                    aria-expanded={openRow === row.id}
                    className="basis-full pl-8 text-left text-xs text-stone-500 hover:text-stone-200"
                  >
                    {on
                      ? "The whole entry is public"
                      : row.passages.some((p) => shared.has(p.id))
                        ? `${row.passages.filter((p) => shared.has(p.id)).length} of ${row.passages.length} passages shared on their own`
                        : "Share just a passage"}{" "}
                    {openRow === row.id ? "▴" : "▾"}
                  </button>
                )}
                {openRow === row.id && (
                  <ul className="basis-full space-y-1.5 pl-8">
                    {row.passages.map((p) => (
                      <li key={p.id}>
                        <label
                          className={`flex items-start gap-3 text-sm ${on ? "opacity-50" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={on || shared.has(p.id)}
                            disabled={on}
                            onChange={(e) =>
                              sharePassage(p.id, e.target.checked)
                            }
                            className="mt-1 h-3.5 w-3.5 accent-[#e8c27a]"
                          />
                          <span className="font-serif text-stone-300">
                            “{p.quote}”
                            <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-stone-600">
                              {p.category}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
        <div className="space-y-3 rounded-xl border border-white/[0.07] bg-panel p-4">
          <h2 className="font-serif text-lg text-ink">Site</h2>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Title</span>
            <input
              value={settings.title}
              onChange={(e) =>
                setSettings({ ...settings, title: e.target.value })
              }
              className={input}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">
              Description
            </span>
            <textarea
              value={settings.description}
              onChange={(e) =>
                setSettings({ ...settings, description: e.target.value })
              }
              rows={2}
              className={input}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">
              Author (optional)
            </span>
            <input
              value={settings.author}
              onChange={(e) =>
                setSettings({ ...settings, author: e.target.value })
              }
              className={input}
            />
          </label>
          <button
            type="button"
            onClick={build}
            disabled={building}
            className="w-full rounded-full bg-ink px-4 py-2 text-sm font-medium text-stone-900 disabled:opacity-60"
          >
            {building ? "Building…" : "Build site"}
          </button>
          {status && (
            <p className="text-xs leading-relaxed text-stone-400">{status}</p>
          )}
          <p className="text-xs text-stone-500">
            {site.builtAt
              ? `Last built ${new Date(site.builtAt).toLocaleString()} · ${site.entries} entries`
              : "Not built yet."}
          </p>
          {site.builtAt && (
            <a
              href={`${site.basePath}/`}
              target="_blank"
              rel="noreferrer"
              className="block text-sm text-stone-200 underline decoration-stone-600 hover:text-ink"
            >
              Preview the site ↗
            </a>
          )}
        </div>

        {site.builtAt && <PushPreview diff={diff} />}

        <div className="space-y-2 text-xs leading-relaxed text-stone-500">
          <p>
            Building only writes files to{" "}
            <code className="text-stone-300">{dir}</code>. Nothing is uploaded.
            Only entries marked Public are included, and unpublishing an entry
            removes it on the next build.
          </p>
          <p>
            When you’re ready, that folder becomes its own public GitHub
            repository for GitHub Pages (it can belong to another account). Then{" "}
            <code className="text-stone-300">npm run publish:push</code> puts
            each build online. See the README.
          </p>
        </div>
      </aside>

      {reading !== null && (
        <EntryPreview
          row={rows[reading]}
          on={published.has(rows[reading].id)}
          onToggle={(value) => toggle(rows[reading].id, value)}
          onStep={(by) =>
            setReading((r) =>
              r === null ? r : Math.min(rows.length - 1, Math.max(0, r + by)),
            )
          }
          canStep={{ newer: reading > 0, older: reading < rows.length - 1 }}
          onClose={() => setReading(null)}
        />
      )}
    </div>
  )
}

// An entry in full, exactly as its page on the public site would look (the
// app's own entry page, read-only), with the choice to publish it right
// there. ← → step to the next entry; Esc closes.
function EntryPreview({
  row,
  on,
  onToggle,
  onStep,
  canStep,
  onClose,
}: {
  row: PublishRow
  on: boolean
  onToggle: (value: boolean) => void
  onStep: (by: number) => void
  canStep: { newer: boolean; older: boolean }
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") onStep(-1)
      if (e.key === "ArrowRight") onStep(1)
    }
    window.addEventListener("keydown", onKey)
    // the page behind stays put
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, onStep])

  // the entry's own page, read-only, as the public site shows it
  const src = `/notes/${row.id}?preview=1`
  const step =
    "rounded-full border border-white/15 px-3 py-1 text-xs text-stone-300 hover:bg-white/5 disabled:opacity-30"
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${titleText(row.title)}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="flex h-full max-h-[920px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#101011] shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              Preview · as it would look on your site
            </p>
            <p className="truncate font-serif text-lg text-ink">
              <EntryTitle title={row.title} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggle(!on)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              on
                ? "bg-ember/15 text-ember hover:bg-ember/25"
                : "bg-ink text-stone-900 hover:bg-white"
            }`}
          >
            {on ? "✓ Public · make private" : "Make public"}
          </button>
          <span className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={!canStep.newer}
              aria-label="Newer entry"
              className={step}
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={!canStep.older}
              aria-label="Older entry"
              className={step}
            >
              →
            </button>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the preview"
            className="rounded-full px-2 text-xl leading-none text-stone-400 hover:text-stone-100"
          >
            ×
          </button>
        </header>
        <iframe
          key={row.id}
          src={src}
          title="How this entry would look on your site"
          className="min-h-0 w-full flex-1 bg-[#101011]"
        />
      </div>
    </div>
  )
}

// What `npm run publish:push` would change on the public site, from the last
// build: new, changed and removed entries (and shared passages).
function PushPreview({ diff }: { diff: SiteDiff }) {
  const total = diff.added.length + diff.changed.length + diff.removed.length
  const group = (label: string, items: string[], tone: string) =>
    items.length > 0 && (
      <div>
        <p
          className={`font-mono text-[10px] uppercase tracking-widest ${tone}`}
        >
          {label} · {items.length}
        </p>
        <ul className="mt-1 space-y-0.5 text-xs text-stone-300">
          {items.slice(0, 12).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
          {items.length > 12 && (
            <li className="text-stone-500">…and {items.length - 12} more</li>
          )}
        </ul>
      </div>
    )
  return (
    <div className="space-y-3 rounded-xl border border-white/[0.07] bg-panel p-4">
      <h2 className="font-serif text-lg text-ink">What&apos;s going public</h2>
      <p className="text-xs text-stone-500">
        {diff.pushedBefore
          ? total
            ? "If you push this build, compared with what's online now:"
            : "This build matches what's online. Nothing would change."
          : "Not pushed yet: everything in this build would become public."}
      </p>
      {group("New on the site", diff.added, "text-ember")}
      {group("Changed", diff.changed, "text-sky-300")}
      {group("Taken off", diff.removed, "text-rose-300")}
      <p className="text-xs text-stone-500">
        Build again after changing what&apos;s public to update this.{" "}
        <code className="text-stone-300">npm run publish:push</code> shows this
        list and asks before pushing.
      </p>
    </div>
  )
}
