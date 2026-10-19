import { titleText } from "@/features/notes/lib/titles"
import type { ExportEntry } from "@/features/export/docx"

// Entries as a diary, in formatted text (HTML) to preview on the Export page
// and paste into a Google Doc: each entry opens with its date (the strongest
// thing on the page), then its title in italics, then the text, all in one
// size, with a small ornament between entries. Inline styles, so Google Docs
// keeps the look when it's pasted.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// "Sunday 5 January 2025" (built from parts, the same everywhere)
export const diaryDate = (d: Date) =>
  `${d.toLocaleDateString("en-US", { weekday: "long" })} ${d.getDate()} ${d.toLocaleDateString("en-US", { month: "long" })} ${d.getFullYear()}`

const monthYear = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", year: "numeric" })

// the span the entries cover: "January 2025 – October 2026"
export function spanOf(entries: ExportEntry[]) {
  if (!entries.length) return ""
  const first = monthYear(entries[0].date)
  const last = monthYear(entries[entries.length - 1].date)
  return first === last ? first : `${first} – ${last}`
}

export const ACCENT = "#8a5a1f"
const FONT = "Georgia, 'Times New Roman', serif"
const BODY = `font-family:${FONT};font-size:12pt;line-height:1.6;color:#222222;margin:0 0 10pt 0`

export function entriesHtml(entries: ExportEntry[], title: string) {
  const body = entries
    .map((e, i) => {
      const paras = e.content
        .trim()
        .split(/\n\s*\n/)
        .map((p) => `<p style="${BODY}">${esc(p).replace(/\n/g, "<br>")}</p>`)
        .join("")
      const name = titleText(e.title)
      return `${
        i > 0
          ? `<p style="${BODY};text-align:center;color:#999999;margin:18pt 0">⁂</p>`
          : ""
      }<p style="font-family:${FONT};font-size:12.5pt;font-weight:bold;font-variant:small-caps;letter-spacing:0.04em;color:${ACCENT};margin:0 0 2pt 0">${esc(diaryDate(e.date))}</p><p style="${BODY};font-style:italic;color:#555555;margin:0 0 8pt 0">${esc(name)}</p>${paras}`
    })
    .join("")
  return `<meta charset="utf-8"><div style="font-family:${FONT}"><p style="font-family:${FONT};font-size:15pt;font-weight:bold;color:#222222;margin:0 0 2pt 0">${esc(title)}</p><p style="${BODY};color:#777777;margin:0 0 20pt 0">${esc(spanOf(entries))} · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}</p>${body}</div>`
}

// the same, as plain text (for pasting where formatting isn't kept)
export function entriesText(entries: ExportEntry[]) {
  return entries
    .map(
      (e) =>
        `${diaryDate(e.date).toUpperCase()}\n${titleText(e.title)}\n\n${e.content.trim()}`,
    )
    .join("\n\n* * *\n\n")
}
