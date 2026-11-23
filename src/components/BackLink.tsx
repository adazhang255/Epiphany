"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

// "← Back" at the top of an entry: to the thread you came from (?thread=…,
// with its ?match level), otherwise to the entry on the timeline. Read in
// the browser, so the public site can build the page once.
export function BackLink({ noteId }: { noteId: string }) {
  const params = useSearchParams()
  const thread = params.get("thread")
  const match = params.get("match")
  const href = thread
    ? `/threads${match ? `?match=${encodeURIComponent(match)}` : ""}#thread-${encodeURIComponent(thread)}`
    : `/#n-${noteId}`
  return (
    <Link
      href={href}
      className="font-mono text-xs uppercase tracking-widest text-stone-500 hover:text-stone-200"
    >
      ← Back to {thread ? "thread" : "timeline"}
    </Link>
  )
}

// an entry's link from a thread, so its page leads back there
export function fromThread(href: string, thread: string, match: string | null) {
  const [path, hash] = href.split("#")
  const extra = `thread=${encodeURIComponent(thread)}${match ? `&match=${encodeURIComponent(match)}` : ""}`
  return `${path}${path.includes("?") ? "&" : "?"}${extra}${hash ? `#${hash}` : ""}`
}
