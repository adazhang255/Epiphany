"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ANALYSIS_EVENT } from "@/components/AnalysisIndicator"
import { Walker } from "@/components/DraggableTimeline"

const PROMPTS = [
  "What moment today deserves a second look?",
  "What have you changed your mind about lately?",
  "What would you tell your past self this week?",
  "What question keeps coming back to you?",
]

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function NoteComposer() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(today)
  const [content, setContent] = useState("")
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = useState("")

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!content.trim()) {
      setError("Write something before saving.")
      return
    }

    setError("")
    setStatus("saving")
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, date }),
    })
    if (!res.ok) {
      setStatus("idle")
      setError("Could not save right now. Please try again.")
      return
    }
    const note = (await res.json()) as { id: string }

    // Saved. Highlights are found in the background on the server; the
    // header shows progress, so there's nothing to wait for here.
    window.dispatchEvent(new Event(ANALYSIS_EVENT))
    setStatus("saved")
    await new Promise((r) => setTimeout(r, 700))
    router.push(`/notes/${note.id}?saved=1`)
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-stone-100 outline-none focus:border-white/30"

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-stone-400">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A thought"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-stone-400">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm text-stone-400">Entry</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="notebook w-full resize-y rounded-xl border border-white/10 py-3 pr-4 font-serif text-[18px] text-stone-100 outline-none focus:border-white/30"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() =>
              setContent((c) => (c ? `${c}\n\n${prompt}\n` : `${prompt}\n`))
            }
            className="rounded-full border border-white/10 px-3 py-1.5 font-serif text-sm text-stone-400 transition hover:bg-white/5 hover:text-stone-200"
          >
            {prompt}
          </button>
        ))}
      </div>

      {status === "idle" ? (
        <div className="flex items-center justify-between gap-4 pt-2">
          <p className="text-sm text-rose-300/80" aria-live="polite">
            {error}
          </p>
          <button
            type="submit"
            className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-stone-900 transition hover:bg-white"
          >
            Save entry
          </button>
        </div>
      ) : (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-2xl border border-ember/30 bg-ember/[0.05] py-4"
        >
          {status === "saved" ? (
            <>
              <span className="save-tick text-xl text-ember">✓</span>
              <span className="save-fade text-stone-100">
                Saved. Highlights will appear in the background.
              </span>
            </>
          ) : (
            <>
              <Walker walking flipped={false} />
              <span className="text-stone-300">Saving…</span>
            </>
          )}
        </div>
      )}
    </form>
  )
}
