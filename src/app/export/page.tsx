import { Suspense } from "react"
import { ExportView } from "@/components/ExportView"

// Export to Google Docs: your entries, formatted as a diary, to copy into a
// new Google Doc or download as a .docx. ?ids=… exports just those (from the
// Notebook's filters or an entry page); otherwise the whole journal.
export default function ExportPage() {
  return (
    <div className="mx-auto max-w-3xl pt-12">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Export
        </p>
        <h1 className="mt-2 font-serif text-4xl text-ink sm:text-5xl">
          Take it with you
        </h1>
        <p className="mt-3 text-stone-400">
          Your entries as a diary, ready for Google Docs: copy them and paste
          into a new doc, or download a .docx (Google Docs or Word opens it).
          It&apos;s made on this computer; nothing is sent anywhere until you
          paste or upload it yourself.
        </p>
      </header>
      <Suspense>
        <ExportView />
      </Suspense>
    </div>
  )
}
