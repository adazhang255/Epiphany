import { chartSpecFor } from "@/features/insights/askChart"
import { computeChart, type ChartData } from "@/features/insights/compute"
import { getInsightsDataset } from "@/features/insights/dataset"
import type { ChartSpec } from "@/features/insights/spec"

// Making a chart in the Ask chat, back and forth: "chart how often I mention
// coffee", then "make it a line", "split by keyword", "only 2025"… until
// it's right, then pin it to Stats. The model only picks the chart; the
// numbers and the reply's facts come from the entries.

const ASKS_FOR_CHART =
  /\b(chart|graph|plot|visuali[sz]e|visuali[sz]ation|histogram|diagram)s?\b/i
// with a chart already on screen: wording that changes it
const CHANGES_CHART =
  /\b(make it|change|instead|switch|turn it|show (it|me)|split|stack|group(ed)? by|by (day|week|month|year|weekday|topic|category|keyword)s?|per (day|week|month|year)|line|bars?|area|percent(age)?|share|proportion|keywords?|add|remove|without|drop|only|just|also|count|mentions?|words|entries|highlights)\b/i

// "keyword frequency over time", "how often I mention X by month"
const COUNTS_OVER_TIME =
  /\b(frequency|mentions|how often|counts?|number of)\b.*\b(over time|by (day|week|month|year|weekday|keyword)s?|per (day|week|month|year))\b/i

export function wantsChart(text: string, chartOnScreen: boolean) {
  if (ASKS_FOR_CHART.test(text) || COUNTS_OVER_TIME.test(text)) return true
  return chartOnScreen && text.length <= 160 && CHANGES_CHART.test(text)
}

export type ChartReply = { spec: ChartSpec; data: ChartData }

export async function chartReply(
  request: string,
  current: ChartSpec | null,
): Promise<{ chart: ChartReply; text: string }> {
  const spec = await chartSpecFor(request, current ?? undefined)
  const data = computeChart(spec, await getInsightsDataset())
  const empty = data.series.every((s) => s.values.every((v) => v === 0))
  const text = empty
    ? `**${spec.title}**\n\nNothing to show for that: no entries match. Try other keywords, or say what to change.`
    : `${current ? "Changed:" : "Here's"} **${spec.title}**.\n\nTell me what to change (for example *“make it a line chart”*, *“split by keyword”*, *“only coffee and tea”*), or pin it to Stats when it's right.`
  return { chart: { spec, data }, text }
}
