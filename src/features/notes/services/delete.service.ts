import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"

// Deleted entries are written here first, so any delete can still be
// recovered by hand. (Runtime only, so the bundler shouldn't trace it.)
const BACKUP_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.BACKUP_DIR ?? "backups",
)

type Note = Awaited<ReturnType<typeof loadForBackup>>[number]

export function loadForBackup(ids: string[]) {
  return prisma.note.findMany({
    where: { id: { in: ids } },
    include: { quotes: true, questions: true },
  })
}

// Back up the entries (with their highlights and questions) to a JSON file,
// then delete them. Returns the backup's path, relative to the project.
export async function deleteWithBackup(notes: Note[], label = "deleted") {
  const ids = notes.map((n) => n.id)
  await mkdir(BACKUP_DIR, { recursive: true })
  const backup = path.join(
    BACKUP_DIR,
    `${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  )
  await writeFile(backup, JSON.stringify(notes, null, 2))

  await prisma.$transaction([
    // highlights belong to their note and go with it (questions cascade)
    prisma.quote.deleteMany({ where: { noteId: { in: ids } } }),
    prisma.note.deleteMany({ where: { id: { in: ids } } }),
  ])
  console.info(`[delete] ${ids.length} entries; backup at ${backup}`)
  return path.relative(process.cwd(), backup)
}
