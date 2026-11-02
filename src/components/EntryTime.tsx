"use client"

import { useSyncExternalStore } from "react"
import { timeOfDay } from "@/features/notes/lib/time"

const noChanges = () => () => {}

// The time an entry was written ("9:41 PM"), after `before` (e.g. " · "),
// or nothing if it has no known time. Worked out in the browser, so it's in
// the reader's own time zone even on a page built once (the public site).
export function EntryTime({
  date,
  createdAt,
  before = "",
}: {
  date: Date | string
  createdAt?: Date | string
  before?: string
}) {
  const inBrowser = useSyncExternalStore(
    noChanges,
    () => true,
    () => false,
  )
  const time = inBrowser ? timeOfDay(date, createdAt) : null
  return time ? (
    <>
      {before}
      {time}
    </>
  ) : null
}
