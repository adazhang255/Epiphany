import { StatsTabs } from "@/components/TimelineTabs"
import { Trackers, TrackersProvider } from "@/components/Trackers"
import { getInsightsDataset } from "@/features/insights/dataset"
import { writingDays } from "@/features/insights/writingDays"
import { listTrackers } from "@/features/trackers/trackers"
import { dayKey } from "@/features/notes/lib/time"

export const dynamic = "force-dynamic"

// Day by day: your writing is one tracker, the ones you answer yourself
// ("How am I feeling?") are the others. Not on the public site.
export default async function TrackersPage() {
  const [notes, trackers] = await Promise.all([
    getInsightsDataset(),
    listTrackers(),
  ])
  const { days } = writingDays(notes)

  return (
    <TrackersProvider initial={trackers} today={dayKey(new Date())}>
      <div>
        <StatsTabs />
        <div className="space-y-10 pt-10">
          <header>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              Trackers
            </p>
            <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
              Your days, tracked
            </h1>
          </header>
          <Trackers days={days} />
        </div>
      </div>
    </TrackersProvider>
  )
}
