import { prisma } from "@/lib/prisma"

// Entries, highlights and threads you starred as favourites: their ids, each kind
// kept as one setting (so starring needs no change to the database's
// tables). An id whose entry or highlight was deleted is simply never shown.

export const ENTRY_STARS = "starred"
export const HIGHLIGHT_STARS = "starredHighlights"
export const THREAD_STARS = "starredThreads"
type Stars = typeof ENTRY_STARS | typeof HIGHLIGHT_STARS | typeof THREAD_STARS

export async function getStarred(key: Stars = ENTRY_STARS): Promise<string[]> {
  const row = await prisma.setting
    .findUnique({ where: { key } })
    .catch(() => null)
  try {
    const ids = JSON.parse(row?.value ?? "[]")
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

// Star one (on) or take its star off; the ids starred now.
export async function setStarred(
  id: string,
  on: boolean,
  key: Stars = ENTRY_STARS,
) {
  const now = new Set(await getStarred(key))
  if (on) now.add(id)
  else now.delete(id)
  const value = JSON.stringify([...now])
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
  return [...now]
}
