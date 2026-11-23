// Which threads grew since you last looked at them: threads you'd seen
// before (a passage in them was there already) that new writing has added
// to since. Shown as a count beside Threads in the nav, and as "new" marks
// on the Threads page.

const DAY = 24 * 60 * 60 * 1000

// When a passage came into the journal: when it was found, if that was soon
// after its entry was written (or imported). Highlights found again for an
// older entry (re-analysed, or marked by hand later) count from when the
// entry was written, so they don't look like new writing.
export function addedAt(found: Date, written: Date): Date {
  return found.getTime() - written.getTime() < 2 * DAY ? found : written
}

type Grows = { id: string; members: { id: string; addedAt?: Date | string }[] }

// thread id → the ids of its passages added after `since` (milliseconds)
export function grownThreads(threads: Grows[], since: number) {
  const grown = new Map<string, string[]>()
  for (const t of threads) {
    const fresh: string[] = []
    let old = false
    for (const m of t.members) {
      if (!m.addedAt) continue
      if (new Date(m.addedAt).getTime() > since) fresh.push(m.id)
      else old = true
    }
    if (old && fresh.length) grown.set(t.id, fresh)
  }
  return grown
}
