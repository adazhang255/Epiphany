import { PublishManager, type PublishRow } from "@/components/PublishManager"
import { PUBLISH_DIR, readSiteInfo } from "@/features/publish/buildSite"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function PublishPage() {
  const [notes, site] = await Promise.all([
    prisma.note.findMany({
      select: {
        id: true,
        title: true,
        date: true,
        published: true,
        _count: { select: { quotes: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    readSiteInfo(),
  ])

  const rows: PublishRow[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    date: n.date.toISOString(),
    highlights: n._count.quotes,
    published: n.published,
  }))

  return (
    <div className="pt-12">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Publish
        </p>
        <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
          Share some of it
        </h1>
        <p className="mt-3 max-w-2xl text-stone-400">
          Everything here is private by default. Choose entries to make public,
          then build a static site with their timeline, highlights and threads.
        </p>
      </header>
      <PublishManager rows={rows} site={site} dir={PUBLISH_DIR} />
    </div>
  )
}
