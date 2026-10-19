"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { usePublicView } from "@/components/usePublicView"
import type { ProfileJob, SavedProfile } from "@/features/profile/profile"

// A portrait of the writer on Stats: values, interests, emotional state and
// shifts over time, written by the local model from the journal. Written (or
// rewritten) when you ask, in the background: you can leave the page and
// come back. The public site's is written from public entries.
export function WriterProfile({
  saved,
  job: initial,
}: {
  saved: SavedProfile | null
  // the background job, if one was started (null on the public site)
  job: ProfileJob | null
}) {
  const router = useRouter()
  const readOnly = usePublicView()
  const [job, setJob] = useState(initial)
  const [error, setError] = useState("")
  const busy = Boolean(job?.running)

  // while it's being written, check back every few seconds; when it's done,
  // show the new profile (or why it failed)
  useEffect(() => {
    if (!busy) return
    const timer = setInterval(async () => {
      const next: ProfileJob | null = await fetch("/api/profile", {
        cache: "no-store",
      })
        .then((r) => r.json())
        .catch(() => null)
      if (!next) return
      setJob(next)
      if (!next.running) {
        if (next.error) setError(next.error)
        router.refresh()
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [busy, router])

  if (readOnly && !saved) return null

  async function write() {
    setError("")
    const res = await fetch("/api/profile", { method: "POST" }).catch(
      () => null,
    )
    const data = await res?.json().catch(() => null)
    if (!res?.ok || !data) return setError("Couldn't reach the app.")
    setJob(data)
  }

  return (
    <section
      aria-labelledby="profile-title"
      className="rounded-2xl border border-white/[0.07] bg-panel p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="profile-title" className="font-serif text-xl text-ink">
            {readOnly ? "About the writer" : "You, from your writing"}
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            {saved
              ? `Written ${new Date(saved.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
              : "A portrait written by your local AI from your entries: what you value, what you keep coming back to, how you've been, and what changed."}
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={write}
            disabled={busy}
            className="rounded-full border border-white/15 px-3 py-1 text-sm text-stone-200 transition hover:bg-white/5 disabled:opacity-50"
          >
            {busy ? "Writing…" : saved ? "↻ Rewrite" : "Write my profile"}
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {busy && (
        <p className="mt-3 text-xs text-stone-500">
          Being written in the background: you can leave this page and come
          back. Nothing leaves your computer.
        </p>
      )}

      {saved && (
        <div className="mt-5 max-w-3xl">
          <Profile markdown={saved.markdown} />
          {!readOnly && (
            <p className="mt-6 text-xs text-stone-600">
              Read from {saved.read} of your entries, spread across your
              journal, by a small local model: a mirror, not a verdict.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// **bold** and *italic* inside a line
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i} className="font-semibold text-stone-100">
        {part.slice(2, -2)}
      </strong>
    ) : part.startsWith("*") && part.length > 2 ? (
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      part
    ),
  )
}

// The profile's simple Markdown: bold section headings ("**Core themes:**",
// alone or followed by text), bullet lists, paragraphs.
function Profile({ markdown }: { markdown: string }) {
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (!bullets.length) return
    blocks.push(
      <ul key={blocks.length} className="mt-2 space-y-2">
        {bullets.map((b, i) => (
          <li
            key={i}
            className="relative pl-4 text-[15px] leading-relaxed text-stone-300 before:absolute before:left-0 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-ember/60"
          >
            {inline(b)}
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }
  for (const raw of markdown.split("\n")) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const bullet = line.match(/^[*-]\s+(.*)$/)
    if (bullet) {
      bullets.push(bullet[1])
      continue
    }
    flush()
    const head = line.match(/^(?:#+\s*)?\*\*([^*]+?):?\*\*:?\s*(.*)$/)
    if (head || /^#+\s/.test(line)) {
      const title = head ? head[1] : line.replace(/^#+\s*/, "")
      blocks.push(
        <h3
          key={blocks.length}
          className="mt-6 font-mono text-[10px] uppercase tracking-widest text-ember/80 first:mt-0"
        >
          {title.replace(/:$/, "")}
        </h3>,
      )
      if (head?.[2])
        blocks.push(
          <p
            key={blocks.length}
            className="mt-2 font-serif text-lg leading-relaxed text-stone-200"
          >
            {inline(head[2])}
          </p>,
        )
      continue
    }
    blocks.push(
      <p
        key={blocks.length}
        className="mt-2 font-serif text-lg leading-relaxed text-stone-200"
      >
        {inline(line)}
      </p>,
    )
  }
  flush()
  return <div>{blocks}</div>
}
