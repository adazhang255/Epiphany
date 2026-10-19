import {
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx"
import { titleText } from "@/features/notes/lib/titles"

// Entries as a Word document (.docx), which Google Docs opens as a document
// of its own: each entry's title as a heading, its date, then its text, a
// page each. Made on this computer; nothing is sent anywhere.

export type ExportEntry = { title: string; date: Date; content: string }

const longDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

// paragraphs split on blank lines; single line breaks kept inside them
function paragraphs(text: string) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map(
      (para) =>
        new Paragraph({
          spacing: { after: 160, line: 300 },
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
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: i > 0,
      children: [new TextRun(titleText(e.title))],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: longDate(e.date), italics: true, color: "777777" }),
      ],
    }),
    ...paragraphs(e.content),
  ])
  const doc = new Document({
    title,
    creator: "Reflections",
    styles: {
      default: { document: { run: { font: "Georgia", size: 24 } } },
    },
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun(title)],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: `${entries.length} ${entries.length === 1 ? "entry" : "entries"} · exported ${longDate(new Date())}`,
                color: "777777",
              }),
            ],
          }),
          ...(entries.length
            ? [new Paragraph({ children: [new PageBreak()] })]
            : []),
          ...body,
        ],
      },
    ],
  })
  return Packer.toBuffer(doc)
}
