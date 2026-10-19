"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

// The Export page: the entries formatted as a diary (as they'll look in
// Google Docs), with Copy to clipboard, Open a new Google Doc and Download
// .docx. ?ids=a,b,c: just those entries; otherwise the whole journal.

type Exported = { html: string; text: string; count: number }

const request = (ids: string[] | undefined, format: "html" | "docx") =>
  fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids ? { ids, format } : { format }),
  })

// copy formatted text where the clipboard API isn't allowed: select it on
// the page and copy, which keeps the formatting too
function copyBySelecting(html: string) {
  const box = document.createElement("div")
  box.contentEditable = "true"
  box.innerHTML = html
  Object.assign(box.style, { position: "fixed", left: "-9999px", top: "0" })
  document.body.appendChild(box)
  const range = document.createRange()
  range.selectNodeContents(box)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  const ok = document.execCommand("copy")
  selection?.removeAllRanges()
  box.remove()
  return ok
}

export function ExportView() {
  const idsParam = useSearchParams().get("ids")
  const ids = idsParam ? idsParam.split(",").filter(Boolean) : undefined
  const key = idsParam ?? ""
  const [data, setData] = useState<{ key: string; value: Exported | null }>()
  const [copied, setCopied] = useState<"" | "yes" | "failed">("")
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let alive = true
    const list = key ? key.split(",") : undefined
    void request(list, "html")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((value: Exported | null) => {
        if (alive) setData({ key, value })
      })
    return () => {
      alive = false
    }
  }, [key])

  const loaded = data?.key === key ? data : undefined
  const exported = loaded?.value

  async function copy() {
    if (!exported) return
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([exported.html], { type: "text/html" }),
          "text/plain": new Blob([exported.text], { type: "text/plain" }),
        }),
      ])
      setCopied("yes")
    } catch {
      setCopied(copyBySelecting(exported.html) ? "yes" : "failed")
    }
  }

  async function download() {
    setDownloading(true)
    const res = await request(ids, "docx").catch(() => null)
    setDownloading(false)
    if (!res?.ok) return
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
  }

  if (!loaded) return <p className="text-stone-500">Getting your entries…</p>
  if (!exported)
    return (
      <p className="text-stone-400">
        Nothing to export yet.{" "}
        <Link href="/write" className="text-ember hover:underline">
          Write the first entry
        </Link>
        .
      </p>
    )

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-2 lg:top-4 mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#0f0f10]/90 px-3 py-3 backdrop-blur">
        <p className="mr-auto text-sm text-stone-300">
          {ids
            ? `${exported.count} of your entries`
            : `Your whole journal · ${exported.count} ${exported.count === 1 ? "entry" : "entries"}`}
          {ids && (
            <>
              {" · "}
              <Link
                href="/export"
                className="text-stone-500 underline hover:text-stone-300"
              >
                export everything instead
              </Link>
            </>
          )}
        </p>
        <button
          type="button"
          onClick={copy}
          className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-stone-900 transition hover:bg-white"
        >
          {copied === "yes" ? "Copied ✓" : "Copy to clipboard"}
        </button>
        <a
          href="https://docs.new"
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-stone-200 transition hover:bg-white/5"
        >
          Open a new Google Doc ↗
        </a>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-stone-200 transition hover:bg-white/5 disabled:opacity-50"
        >
          {downloading ? "Downloading…" : "Download .docx"}
        </button>
        <p className="w-full text-xs text-stone-500" aria-live="polite">
          {copied === "yes"
            ? "Copied. Open a new Google Doc and paste (⌘V / Ctrl+V): it keeps this look."
            : copied === "failed"
              ? "Your browser didn't allow copying. Select the page below and copy it, or download the .docx."
              : "Copy, then paste into a new Google Doc. Or download the .docx and open it in Google Docs (Drive → New → File upload) or Word."}
        </p>
      </div>

      {/* the diary, as it will look in the document */}
      <article
        aria-label="Preview"
        className="rounded-sm bg-[#fbf8f2] px-6 py-10 text-[#222] shadow-2xl shadow-black/40 sm:px-14"
        dangerouslySetInnerHTML={{ __html: exported.html }}
      />
    </div>
  )
}
