"use client"

import { useState } from "react"
import { usePublicView } from "@/components/usePublicView"

// Download entries as a .docx that Google Docs opens as a document: in
// Google Drive, New → File upload, then open it with Google Docs (or drop it
// into Drive). Made on this computer; nothing leaves it until you upload it.
function ExportDocsButtonInner({
  ids,
  label = "Export to Google Docs",
  className = "",
}: {
  // the entries to export; none given: the whole journal
  ids?: string[]
  label?: string
  className?: string
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle")

  async function exportDocs() {
    setState("busy")
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    }).catch(() => null)
    if (!res?.ok) return setState("error")
    const blob = await res.blob()
    const name =
      decodeURIComponent(
        res.headers
          .get("Content-Disposition")
          ?.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? "",
      ) || "Journal.docx"
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    setState("done")
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={exportDocs}
        disabled={state === "busy"}
        title="Download a .docx file that Google Docs (or Word) opens as a document"
        className="rounded-full border border-white/15 px-3 py-1 text-sm text-stone-200 transition hover:bg-white/5 disabled:opacity-50"
      >
        {state === "busy" ? "Exporting…" : label}
      </button>
      {state === "done" && (
        <span className="text-xs text-stone-500">
          Downloaded. In Google Drive: New → File upload, then open it with
          Google Docs.
        </span>
      )}
      {state === "error" && (
        <span className="text-xs text-rose-300">
          Couldn’t export. Try again.
        </span>
      )}
    </span>
  )
}

// Reads your journal, so it isn't part of the read-only public site.
export function ExportDocsButton(
  props: React.ComponentProps<typeof ExportDocsButtonInner>,
) {
  return usePublicView() ? null : <ExportDocsButtonInner {...props} />
}
