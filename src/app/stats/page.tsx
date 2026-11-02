import { StatsTabs } from "@/components/TimelineTabs"
import { AnalyzeAllButton } from "@/components/AnalyzeAllButton"
import { ReanalyzeAllButton } from "@/components/ReanalyzeAllButton"
import { PinnedCharts } from "@/components/PinnedCharts"
import { parseSpec } from "@/features/insights/spec"
import {
  getSavedCharts,
  getTimeline,
} from "@/features/notes/services/notes.service"
import { ClassifyButton } from "@/components/ClassifyButton"
import { OnThisDayToday } from "@/components/OnThisDayToday"
import { WriterProfile } from "@/components/WriterProfile"
import { YearInReview } from "@/components/YearInReview"
import { yearReviews } from "@/features/insights/yearReview"
import { getThreads } from "@/features/threads/build"
import {
  profileJob,
  readProfile,
  writeProfile,
} from "@/features/profile/profile"
import { PUBLIC_SITE } from "@/lib/site-mode"
import { CategoryLanes } from "@/components/CategoryLanes"
import { DayHeatmap } from "@/components/DayHeatmap"
import { writingDays } from "@/features/insights/writingDays"
import { getInsightsDataset } from "@/features/insights/dataset"
import { categoryColor, categoryGlyph } from "@/features/notes/lib/topics"

export const dynamic = "force-dynamic"

export default async function StatsPage() {
  const [notes, charts, memories, profile, threads] = await Promise.all([
    getInsightsDataset(),
    getSavedCharts(),
    getTimeline(),
    // the public site's is written from its public entries as it's built
    PUBLIC_SITE
      ? writeProfile({ save: false }).catch(() => null)
      : readProfile(),
    getThreads("related").then((t) => t.threads),
  ])
  const years = yearReviews(memories, threads)
  const pinned = charts.flatMap((chart) => {
    try {
      return [{ id: chart.id, spec: parseSpec(JSON.parse(chart.spec)) }]
    } catch {
      return []
    }
  })

  const { days, categoryTotals } = writingDays(notes)

  const topCategory = [...categoryTotals.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0]
  const tiles = [
    { label: "Entries", value: notes.length },
    {
      label: "Highlights",
      value: notes.reduce((n, note) => n + note.quotes.length, 0),
    },
    { label: "Days written", value: Object.keys(days).length },
    {
      label: "Words",
      value: notes.reduce((n, note) => n + note.words, 0).toLocaleString(),
    },
  ]
  const unanalyzed = notes.filter((n) => n.topics.length === 0).map((n) => n.id)

  return (
    <div>
      <StatsTabs />
      <div className="space-y-10 pt-10">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Statistics
          </p>
          <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
            Your writing, measured
          </h1>
        </header>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-xl border border-white/[0.07] bg-panel p-4"
            >
              <dt className="text-xs text-stone-500">{tile.label}</dt>
              <dd className="mt-1 font-serif text-3xl text-ink">
                {tile.value}
              </dd>
            </div>
          ))}
          <div className="col-span-2 rounded-xl border border-white/[0.07] bg-panel p-4 sm:col-span-1">
            <dt className="text-xs text-stone-500">Most common highlight</dt>
            <dd className="mt-2 flex items-center gap-2 font-serif text-xl text-ink">
              {topCategory ? (
                <>
                  <span
                    aria-hidden
                    className="h-3 w-3 rounded-sm"
                    style={{ background: categoryColor(topCategory) }}
                  />
                  {categoryGlyph(topCategory)} {topCategory}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>

        <div className="space-y-3">
          <AnalyzeAllButton noteIds={unanalyzed} />
          <ReanalyzeAllButton noteIds={notes.map((n) => n.id)} />
          <ClassifyButton
            missing={notes.filter((n) => n.sentiment === null).length}
          />
        </div>

        <WriterProfile
          saved={profile}
          job={PUBLIC_SITE ? null : profileJob()}
        />

        <YearInReview years={years} />

        <OnThisDayToday
          notes={memories.map((n) => ({
            id: n.id,
            title: n.title,
            date: n.date,
            createdAt: n.createdAt,
            content: n.content,
            ownCategory: n.ownCategory,
            quotes: n.quotes.map((q) => ({
              id: q.id,
              quote: q.quote,
              category: q.category,
            })),
          }))}
          className=""
          moreHref="/on-this-day"
          showEmpty
        />

        <DayHeatmap days={days} />

        <CategoryLanes
          today={new Date().toISOString()}
          entries={notes.map((n) => ({
            id: n.id,
            title: n.title,
            date: n.date,
            category: n.purposes[0] ?? null,
            sentiment: n.sentiment,
          }))}
        />

        <PinnedCharts saved={pinned} notes={notes} />
      </div>
    </div>
  )
}
