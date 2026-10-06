"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Chart } from "@/components/Chart"
import type { SavedChartView } from "@/components/ChartBuilder"
import { computeChart, type InsightNote } from "@/features/insights/compute"

// Charts pinned from the Custom page, on the Stats overview.
export function PinnedCharts({
  saved,
  notes,
}: {
  saved: SavedChartView[]
  notes: InsightNote[]
}) {
  const router = useRouter()

  async function unpin(id: string) {
    await fetch(`/api/charts/${id}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <section id="pinned" aria-labelledby="pinned-title">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="pinned-title" className="font-serif text-xl text-ink">
          Pinned charts
        </h2>
        <Link
          href="/custom"
          className="text-sm text-stone-400 underline hover:text-stone-200"
        >
          Make another in Custom →
        </Link>
      </div>
      {saved.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-stone-500">
          Nothing pinned yet. Build a chart in{" "}
          <Link href="/custom" className="text-ember hover:underline">
            Custom
          </Link>{" "}
          and press “Pin to Stats” to keep it here.
        </p>
      ) : (
        <ul className="grid gap-6 lg:grid-cols-2">
          {saved.map((chart) => (
            <li
              key={chart.id}
              className="min-w-0 rounded-2xl border border-white/[0.07] bg-panel p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <h3 className="font-serif text-lg text-ink">
                  {chart.spec.title}
                </h3>
                <div className="flex shrink-0 gap-3 text-xs">
                  <Link
                    href={`/custom?edit=${chart.id}`}
                    className="text-stone-400 underline hover:text-stone-200"
                  >
                    Edit in Custom
                  </Link>
                  <button
                    type="button"
                    onClick={() => unpin(chart.id)}
                    className="text-stone-500 underline hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <Chart
                data={computeChart(chart.spec, notes)}
                kind={chart.spec.chart}
                percent={chart.spec.normalize}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
