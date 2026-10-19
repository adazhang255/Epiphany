"use client"

import { usePublicView } from "@/components/usePublicView"
import { useRouter } from "next/navigation"
import { useState } from "react"

function PublishToggleInner({
  noteId,
  published,
}: {
  noteId: string
  published: boolean
}) {
  const router = useRouter()
  const [on, setOn] = useState(published)
  const [pending, setPending] = useState(false)

  async function flip() {
    setPending(true)
    const res = await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !on }),
    })
    if (res.ok) {
      setOn(!on)
      router.refresh()
    }
    setPending(false)
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] px-3 py-2">
      <span className="text-sm text-stone-300">
        {on ? "Public on your site" : "Private"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Include in the public site"
        disabled={pending}
        onClick={flip}
        className={`relative h-5 w-9 rounded-full transition ${on ? "bg-ember" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#101011] transition-all ${on ? "left-[18px]" : "left-0.5"}`}
        />
      </button>
    </div>
  )
}

// Edits your journal, so it isn't part of the read-only public site.
export function PublishToggle(
  props: React.ComponentProps<typeof PublishToggleInner>,
) {
  return usePublicView() ? null : <PublishToggleInner {...props} />
}
