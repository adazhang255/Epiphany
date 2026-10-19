import { Suspense } from "react"
import { StatsTabs } from "@/components/TimelineTabs"
import { ChartBuilder, type SavedChartView } from "@/components/ChartBuilder"
import { getInsightsDataset } from "@/features/insights/dataset"
import { parseSpec } from "@/features/insights/spec"
import { getSavedCharts } from "@/features/notes/services/notes.service"

export const dynamic = "force-dynamic"

export default async function CustomPage() {
  const [notes, charts] = await Promise.all([
    getInsightsDataset(),
    getSavedCharts(),
  ])

  // a new order for the suggestions each visit (this page renders per visit)
  // eslint-disable-next-line react-hooks/purity -- meant to differ each time
  const seed = Math.random()

  const saved: SavedChartView[] = charts.flatMap((chart) => {
    try {
      return [{ id: chart.id, spec: parseSpec(JSON.parse(chart.spec)) }]
    } catch {
      return []
    }
  })

  return (
    <div>
      <StatsTabs />
      <div className="pt-10">
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Custom
          </p>
          <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
            See it your way
          </h1>
          <p className="mt-3 max-w-2xl text-stone-400">
            Build a chart from your entries, or ask for one in plain words. Pin
            the ones worth keeping to the Stats overview. (Trackers, for
            answering a question each day yourself, are on the overview too.)
          </p>
        </header>
        <Suspense>
          <ChartBuilder notes={notes} saved={saved} seed={seed} />
        </Suspense>
      </div>
    </div>
  )
}
