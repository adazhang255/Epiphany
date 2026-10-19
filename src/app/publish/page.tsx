import { PublishManager, type PublishRow } from "@/components/PublishManager"
import { PUBLISH_DIR, readSiteInfo } from "@/features/publish/buildSite"
import { describeItem, siteDiff } from "../../../scripts/site-diff.mjs"
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
        quotes: {
          select: { id: true, quote: true, category: true, published: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    readSiteInfo(),
  ])

  // what pushing the last build would change online
  const d = siteDiff(PUBLISH_DIR)
  const diff = {
    pushedBefore: d.pushedBefore as boolean,
    added: d.added.map(describeItem) as string[],
    changed: d.changed.map(describeItem) as string[],
    removed: d.removed.map(describeItem) as string[],
  }

  const rows: PublishRow[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    date: n.date.toISOString(),
    highlights: n.quotes.length,
    published: n.published,
    passages: n.quotes,
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
          then build your site: this same app, read-only, with only those
          entries in it.
        </p>
      </header>
      <PublishManager rows={rows} site={site} dir={PUBLISH_DIR} diff={diff} />
    </div>
  )
}
