"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import type { SiteInfo } from "@/features/publish/buildSite"

export type PublishRow = {
  id: string
  title: string
  date: string // ISO
  highlights: number
  published: boolean
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function PublishManager({
  rows,
  site,
  dir,
}: {
  rows: PublishRow[]
  site: SiteInfo
  dir: string
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
          <span className="text-xs text-stone-500">
            {published.size} of {rows.length} public
          </span>
        </div>
        <ul className="divide-y divide-white/5 rounded-xl border border-white/[0.07]">
          {rows.map((row) => {
            const on = published.has(row.id)
            return (
              <li key={row.id}>
                <label className="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-white/[0.02]">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => toggle(row.id, e.target.checked)}
                    className="h-4 w-4 accent-[#e8c27a]"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate ${on ? "text-ink" : "text-stone-300"}`}
                    >
                      {row.title || "Untitled thought"}
                    </span>
                    <span className="text-xs text-stone-500">
                      {shortDate(row.date)} · {row.highlights} highlights
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                      on ? "bg-ember/15 text-ember" : "text-stone-600"
                    }`}
                  >
                    {on ? "Public" : "Private"}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
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
              href="/preview/index.html"
              target="_blank"
              rel="noreferrer"
              className="block text-sm text-stone-200 underline decoration-stone-600 hover:text-ink"
            >
              Preview the site ↗
            </a>
          )}
        </div>

        <div className="space-y-2 text-xs leading-relaxed text-stone-500">
          <p>
            Building only writes files to{" "}
            <code className="text-stone-300">{dir}</code>. Nothing is uploaded.
            Only entries marked Public are included, and unpublishing an entry
            removes it on the next build.
          </p>
          <p>
            When you’re ready, that folder becomes its own public GitHub
            repository for GitHub Pages. See the README.
          </p>
        </div>
      </aside>
    </div>
  )
}
