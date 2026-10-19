import { Suspense } from "react"
import { TimelineView, type DuplicateGroups } from "@/components/TimelineView"
import { loadQuestionViews } from "@/features/questions/views"
import {
  findDuplicateGroups,
  getTimeline,
} from "@/features/notes/services/notes.service"
import { mergeTags, splitList } from "@/features/notes/lib/topics"
import { PUBLIC_SITE } from "@/lib/site-mode"

export const dynamic = "force-dynamic"

// The timeline: every entry's highlights by month and day. The page loads
// the entries once; the view applies ?type, ?order, ?q and ?kind in the
// browser (so the public site, built once, filters the same way).
export default async function TimelinePage() {
  const [timeline, duplicates, questions] = await Promise.all([
    getTimeline(),
    PUBLIC_SITE ? [] : findDuplicateGroups(),
    loadQuestionViews(),
  ])
  const notes = timeline.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    date: n.date,
    createdAt: n.createdAt,
    ownCategory: n.ownCategory,
    quotes: n.quotes.map((q) => ({
      id: q.id,
      quote: q.quote,
      category: q.category,
      manual: q.manual,
    })),
  }))
  const groups: DuplicateGroups = duplicates.map((g) => ({
    content: g.keep.content,
    date: g.keep.date.toISOString(),
    copies: [g.keep, ...g.remove].map((n) => ({
      id: n.id,
      title: n.title,
      date: n.date.toISOString(),
      published: n.published,
      topics: splitList(n.topics),
      tags: mergeTags(n.tags, n.autoTags),
      highlights: n.quotes.map((q) => q.quote),
    })),
  }))
  return (
    <Suspense>
      <TimelineView notes={notes} duplicates={groups} questions={questions} />
    </Suspense>
  )
}
