import { NoteComposer } from "@/components/NoteComposer"
import { DraftTabs } from "@/components/DraftTabs"
import { getCustomCategories } from "@/features/notes/services/notes.service"
import { listQuotes, quotesEnabled } from "@/features/quotes/quotes"
import { quoteForDay } from "@/features/quotes/lib"
import { dayKey } from "@/features/notes/lib/time"

export const dynamic = "force-dynamic"

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>
}) {
  // which of your drafts (none: the first one)
  const { draft } = await searchParams
  const draftId = draft && /^[a-z0-9]{1,16}$/.test(draft) ? draft : ""
  const [custom, quotesOn] = await Promise.all([
    getCustomCategories(),
    quotesEnabled(),
  ])
  // one of the quotes you keep, to start from (if you've added Quotes)
  const quote = quotesOn
    ? quoteForDay((await listQuotes()) ?? [], dayKey(new Date()))
    : null
  return (
    <div className="mx-auto max-w-3xl pt-12">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        New entry
      </p>
      <h1 className="mt-2 mb-8 font-serif text-4xl text-ink">
        A blank page for your thoughts
      </h1>
      {quote && (
        <figure className="-mt-4 mb-8 border-l-2 border-ember/30 pl-4">
          <blockquote className="font-serif text-lg italic leading-snug text-stone-400">
            “{quote.text}”
          </blockquote>
          {quote.author && (
            <figcaption className="mt-1 text-xs text-stone-500">
              — {quote.author}
            </figcaption>
          )}
        </figure>
      )}
      <DraftTabs current={draftId} />
      <NoteComposer key={draftId} custom={custom} draftId={draftId} />
    </div>
  )
}
