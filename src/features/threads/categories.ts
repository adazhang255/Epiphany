import { prisma } from "@/lib/prisma"

// Threads' categories (the same kinds as highlights: Writing, Insight… or
// one of your own), kept as one setting: thread id → category. Only
// threads with an id that lasts (yours, or a question's) have one; see
// keepThread.

const KEY = "threadCategories"

export async function getThreadCategories(): Promise<Record<string, string>> {
  const row = await prisma.setting
    .findUnique({ where: { key: KEY } })
    .catch(() => null)
  try {
    const map = JSON.parse(row?.value ?? "{}")
    if (!map || typeof map !== "object" || Array.isArray(map)) return {}
    return Object.fromEntries(
      Object.entries(map).filter(
        (e): e is [string, string] => typeof e[1] === "string",
      ),
    )
  } catch {
    return {}
  }
}

// Set a thread's category, or take it off (null).
export async function setThreadCategory(id: string, category: string | null) {
  const map = await getThreadCategories()
  if (category) map[id] = category
  else delete map[id]
  const value = JSON.stringify(map)
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value },
    update: { value },
  })
}
