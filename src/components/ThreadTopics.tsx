"use client"

import { useThreadTitle } from "@/components/threadTitles"

export type TopicItem = {
  id: string
  title: string | null // known when the page was built
  fallback: string // its opening words
  count: number
}

function Topic({ topic }: { topic: TopicItem }) {
  // a title the model writes after the page opened shows here too
  const shared = useThreadTitle(topic.id)
  const title = topic.title ?? shared
  return (
    <li>
      <a
        href={`#thread-${topic.id}`}
        className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-sm transition hover:border-ember/50 hover:text-ink"
      >
        <span className={title ? "text-stone-200" : "text-stone-500"}>
          {title ?? topic.fallback}
        </span>
        <span className="font-mono text-[10px] text-stone-500">
          {topic.count}
        </span>
      </a>
    </li>
  )
}

// Every thread's topic in one list at the top of the page: click one to
// jump to it.
export function ThreadTopics({ topics }: { topics: TopicItem[] }) {
  if (topics.length === 0) return null
  return (
    <nav aria-label="Thread topics" className="mb-8">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {topics.length} {topics.length === 1 ? "thread" : "threads"}
      </p>
      <ul className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <Topic key={t.id} topic={t} />
        ))}
      </ul>
    </nav>
  )
}
