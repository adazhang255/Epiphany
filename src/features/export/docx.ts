import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx"
import { titleText } from "@/features/notes/lib/titles"
import { ACCENT, diaryDate, spanOf } from "@/features/export/html"

// Entries as a diary in a Word document (.docx), which Google Docs opens as
// a document of its own. The same look as the Export page's preview: each
// entry opens with its date, then its title in italics, then the text, all
// near one size, with a small ornament between entries. Made on this
// computer; nothing is sent anywhere.

export type ExportEntry = { title: string; date: Date; content: string }

const color = ACCENT.slice(1)
const BODY = 24 // half-points: 12pt

// paragraphs split on blank lines; single line breaks kept inside them
function paragraphs(text: string) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map(
      (para) =>
        new Paragraph({
          spacing: { after: 200, line: 384 },
          children: para
            .split("\n")
            .map(
              (line, i) =>
                new TextRun({ text: line, break: i > 0 ? 1 : undefined }),
            ),
        }),
    )
}

export async function entriesDocx(entries: ExportEntry[], title: string) {
  const body = entries.flatMap((e, i) => [
    ...(i > 0
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 280, after: 280 },
            children: [new TextRun({ text: "⁂", color: "999999" })],
          }),
        ]
      : []),
    new Paragraph({
      spacing: { after: 40 },
      keepNext: true,
      children: [
        new TextRun({
          text: diaryDate(e.date),
          bold: true,
          smallCaps: true,
          color,
          size: 25,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      keepNext: true,
      children: [
        new TextRun({
          text: titleText(e.title),
          italics: true,
          color: "555555",
        }),
      ],
    }),
    ...paragraphs(e.content),
  ])
  const doc = new Document({
    title,
    creator: "Reflections",
    styles: {
      default: {
        document: { run: { font: "Georgia", size: BODY, color: "222222" } },
      },
    },
    sections: [
      {
        children: [
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: title, bold: true, size: 30 })],
          }),
          new Paragraph({
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: `${spanOf(entries)} · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`,
                color: "777777",
              }),
            ],
          }),
          ...body,
        ],
      },
    ],
  })
  return Packer.toBuffer(doc)
}
