import { Suspense } from "react"
import { ThreadsView } from "@/components/ThreadsView"
import { getThreads } from "@/features/threads/build"
import { titleThread } from "@/features/threads/titles"
import { PUBLIC_SITE } from "@/lib/site-mode"

export const dynamic = "force-dynamic"

// Threads: highlights from different days about the same idea. Built at
// every match level here; the view picks one from ?match in the browser (so
// the public site, built once, can switch too).
export default async function ThreadsPage() {
  const [close, related, loose] = await Promise.all([
    getThreads("close"),
    getThreads("related"),
    getThreads("loose"),
  ])
  // The public site can't ask the model later, so name its threads now
  // (when Ollama is running; otherwise they show their opening words).
  if (PUBLIC_SITE) {
    for (const t of [close, related, loose].flatMap((l) => l.threads)) {
      if (t.title) continue
      const ids = t.members
        .map((m) => m.id)
        .filter((id) => !id.startsWith("q-"))
      if (ids.length >= 2) t.title = await titleThread(ids).catch(() => null)
    }
  }
  // embeddings stay on the server: the page only needs the words
  const slim = (list: typeof related.threads) =>
    list.map((t) => ({
      ...t,
      members: t.members.map((m) => ({ ...m, embedding: [] })),
    }))
  return (
    <Suspense>
      <ThreadsView
        byLevel={{
          close: slim(close.threads),
          related: slim(related.threads),
          loose: slim(loose.threads),
        }}
        missing={related.missing}
      />
    </Suspense>
  )
}
