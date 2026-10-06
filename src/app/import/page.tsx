import { ImportWizard } from "@/components/ImportWizard"

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl pt-12">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Import
        </p>
        <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
          Bring in old writing
        </h1>
        <p className="mt-3 text-stone-400">
          Turn a Google Doc into entries. It’s split, titled and dated by the
          model running in Ollama on this computer; nothing is sent to an AI
          service.
        </p>
      </header>
      <ImportWizard />
    </div>
  )
}
