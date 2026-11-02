import { NoteComposer } from "@/components/NoteComposer"
import { getCustomCategories } from "@/features/notes/services/notes.service"

export const dynamic = "force-dynamic"

export default async function WritePage() {
  const custom = await getCustomCategories()
  return (
    <div className="mx-auto max-w-3xl pt-12">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        New entry
      </p>
      <h1 className="mt-2 mb-8 font-serif text-4xl text-ink">
        A blank page for your thoughts
      </h1>
      <NoteComposer custom={custom} />
    </div>
  )
}
