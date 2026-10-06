import { AskJournal } from "@/components/AskJournal"

export default function AskPage() {
  return (
    <div className="mx-auto max-w-3xl pt-12">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Ask your journal
        </p>
        <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
          Talk it through
        </h1>
        <p className="mt-3 text-stone-400">
          Answers come only from your entries, with links to the ones used, and
          end with a question to keep you thinking. It can also find entries,
          and propose deleting or adding them, which you review and confirm.
          Everything runs in Ollama on this computer; the conversation is kept
          only in this browser until you type /new.
        </p>
      </header>
      <AskJournal />
    </div>
  )
}
