import { prisma } from "@/lib/prisma"

// Entries you starred as favourites: their ids, kept as one setting (so
// starring needs no change to the database's tables). An id whose entry was
// deleted is simply never shown.

const KEY = "starred"

export async function getStarred(): Promise<string[]> {
  const row = await prisma.setting
    .findUnique({ where: { key: KEY } })
    .catch(() => null)
  try {
    const ids = JSON.parse(row?.value ?? "[]")
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

// Star an entry (on) or take its star off; the ids starred now.
export async function setStarred(id: string, on: boolean) {
  const now = new Set(await getStarred())
  if (on) now.add(id)
  else now.delete(id)
  const value = JSON.stringify([...now])
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value },
    update: { value },
  })
  return [...now]
}
