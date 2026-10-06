"use client"

import { useEffect, useState } from "react"

// A short "saved" confirmation that slides in after writing an entry, then
// tidies the ?saved flag out of the address so a reload doesn't repeat it.
export function SavedToast({
  highlights,
  pending,
}: {
  highlights: number
  pending: boolean
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete("saved")
    window.history.replaceState(null, "", url)
    const t = setTimeout(() => setVisible(false), 4200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      role="status"
      className={`pointer-events-none fixed left-1/2 top-20 z-40 -translate-x-1/2 transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
      }`}
    >
      <p className="save-toast flex items-center gap-2 rounded-full border border-ember/40 bg-[#161617]/95 px-4 py-2 text-sm text-stone-100 shadow-xl backdrop-blur">
        <span className="text-ember">✓</span>
        Saved to your timeline
        {pending ? (
          <span className="text-stone-400">· highlights coming</span>
        ) : (
          highlights > 0 && (
            <span className="text-stone-400">
              · {highlights} highlight{highlights === 1 ? "" : "s"}
            </span>
          )
        )}
      </p>
    </div>
  )
}
