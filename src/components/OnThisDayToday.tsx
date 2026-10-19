"use client"

import { OnThisDay } from "@/components/OnThisDay"
import { useToday } from "@/components/useTopicSearch"

// On this day for the visitor's own today, worked out in the browser (so a
// page built once, like the public site's, never shows a stale date).
export function OnThisDayToday(
  props: Omit<React.ComponentProps<typeof OnThisDay>, "today">,
) {
  const today = useToday()
  return today ? <OnThisDay {...props} today={today} /> : null
}
