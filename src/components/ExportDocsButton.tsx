"use client"

import Link from "next/link"
import { usePublicView } from "@/components/usePublicView"

// Opens the Export page for these entries (or the whole journal): a diary
// preview with Copy to clipboard, Open a new Google Doc and Download .docx.
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
  return (
    <Link
      href={ids ? `/export?ids=${ids.join(",")}` : "/export"}
      className={`inline-block rounded-full border border-white/15 px-3 py-1 text-sm text-stone-200 transition hover:bg-white/5 ${className}`}
    >
      {label}
    </Link>
  )
}

// Reads your journal, so it isn't part of the read-only public site.
export function ExportDocsButton(
  props: React.ComponentProps<typeof ExportDocsButtonInner>,
) {
  return usePublicView() ? null : <ExportDocsButtonInner {...props} />
}
