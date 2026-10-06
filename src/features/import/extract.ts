import mammoth from "mammoth"

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export class ImportError extends Error {}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
}

// HTML (Google Docs export, .docx via mammoth, saved web pages) to plain text.
// Headings become "# " lines so the splitter can use them as entry breaks.
export function htmlToText(html: string) {
  return html
    .replace(/<(head|style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(
      /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi,
      (_, inner) => `\n\n# ${inner}\n\n`,
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/(p|div|li|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (match, code: string) => {
      if (code.startsWith("#x"))
        return String.fromCodePoint(parseInt(code.slice(2), 16))
      if (code.startsWith("#") && code !== "#39")
        return String.fromCodePoint(Number(code.slice(1)))
      return ENTITIES[code.toLowerCase()] ?? match
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function textFromFile(name: string, data: Buffer) {
  if (data.byteLength > MAX_IMPORT_BYTES) {
    throw new ImportError("That file is over 5 MB.")
  }
  const ext = name.toLowerCase().split(".").pop()
  switch (ext) {
    case "txt":
    case "md":
    case "markdown":
      return data.toString("utf8").replace(/\r\n/g, "\n").trim()
    case "html":
    case "htm":
      return htmlToText(data.toString("utf8"))
    case "docx": {
      const { value } = await mammoth.convertToHtml({ buffer: data })
      return htmlToText(value)
    }
    default:
      throw new ImportError(
        "Use a .docx, .md, .txt or .html file. In Google Docs: File → Download.",
      )
  }
}

// Download a Google Doc through its export link. This only works for docs
// shared as "Anyone with the link can view"; it's a plain download from
// Google, no AI service is involved.
export async function textFromGoogleDoc(link: string) {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    throw new ImportError("That doesn't look like a link.")
  }
  const id = url.pathname.match(/\/document\/(?:u\/\d+\/)?d\/([\w-]+)/)?.[1]
  if (url.hostname !== "docs.google.com" || !id) {
    throw new ImportError(
      "Paste a Google Docs link (docs.google.com/document/d/…).",
    )
  }

  const res = await fetch(
    `https://docs.google.com/document/d/${id}/export?format=html`,
    {
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    },
  ).catch(() => null)
  const type = res?.headers.get("content-type") ?? ""
  if (
    !res?.ok ||
    new URL(res.url).hostname !== "docs.google.com" ||
    !type.includes("text/html")
  ) {
    throw new ImportError(
      "Couldn't download that doc. Either share it as “Anyone with the link can view”, or (better for private docs) use File → Download → .docx and upload the file.",
    )
  }
  const html = await res.text()
  const title =
    htmlToText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "") ||
    "Google Doc"
  return { title, text: htmlToText(html) }
}
