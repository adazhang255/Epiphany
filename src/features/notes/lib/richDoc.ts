import { Mark, Schema, type Node, type NodeSpec } from "prosemirror-model"
import {
  BOLD,
  BULLET,
  ITALIC,
  MARKER,
  QUOTE,
  RULE,
  STRIKE,
  UNDERLINE,
  formatFlags,
} from "@/features/notes/lib/markdown"

// An entry's text as the rich editor holds it: one block per line of the
// text (a plain line, a heading, a quote, a bullet, a numbered line or a
// divider), its words bold, italic, underlined or struck through. The
// entry is still stored as its text, written the Markdown way (see
// lib/markdown); these turn one into the other, and keep a map between
// places in the text and places in the editor (highlights and selections
// are kept as places in the text).

const line = (): NodeSpec => ({
  content: "inline*",
  group: "block",
  defining: true,
  toDOM: () => ["p", 0],
})

export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { ...line(), parseDOM: [{ tag: "p" }] },
    heading: {
      ...line(),
      attrs: { level: { default: 1 } },
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 2 } },
      ],
      toDOM: (n: Node) =>
        ["p", { class: n.attrs.level === 1 ? "rt-h1" : "rt-h2" }, 0] as const,
    },
    quote: {
      ...line(),
      // "> " or ">" (kept as written)
      attrs: { space: { default: true } },
      toDOM: () => ["p", { class: "rt-quote" }, 0] as const,
    },
    bullet: {
      ...line(),
      attrs: { indent: { default: "" }, mark: { default: "-" } },
      toDOM: (n: Node) =>
        [
          "p",
          {
            class: "rt-bullet",
            style: `margin-left:${n.attrs.indent.length * 0.5}em`,
          },
          0,
        ] as const,
    },
    numbered: {
      ...line(),
      attrs: {
        indent: { default: "" },
        n: { default: 1 },
        sep: { default: "." },
      },
      toDOM: (n: Node) =>
        [
          "p",
          {
            class: "rt-numbered",
            "data-n": `${n.attrs.n}${n.attrs.sep}`,
            style: `margin-left:${n.attrs.indent.length * 0.5}em`,
          },
          0,
        ] as const,
    },
    rule: {
      group: "block",
      atom: true,
      selectable: true,
      // the dashes as written ("---", "***"…)
      attrs: { text: { default: "---" } },
      toDOM: () => ["div", { class: "rt-rule", contenteditable: "false" }],
    },
    text: { group: "inline" },
  },
  marks: {
    // (pasted from elsewhere: the usual tags; Google Docs wraps
    // everything in a <b> of normal weight, which isn't bold)
    bold: {
      parseDOM: [
        { tag: "strong" },
        {
          tag: "b",
          getAttrs: (el: HTMLElement) =>
            el.style.fontWeight === "normal" ? false : null,
        },
      ],
      toDOM: () => ["strong", 0] as const,
    },
    // "*" or "_", as written
    italic: {
      attrs: { marker: { default: "_" } },
      parseDOM: [{ tag: "em" }, { tag: "i" }],
      toDOM: () => ["em", 0] as const,
    },
    underline: { parseDOM: [{ tag: "u" }], toDOM: () => ["u", 0] as const },
    strike: {
      parseDOM: [{ tag: "s" }, { tag: "del" }, { tag: "strike" }],
      toDOM: () => ["s", 0] as const,
    },
  },
})

const HEADING = /^(#{1,3})[ \t]+(?=\S)/
const QUOTE_START = /^>([ \t]?)/
const BULLET_START = /^([ \t]*)([-*])[ \t]+(?=\S)/
const NUMBERED_START = /^([ \t]*)(\d+)([.)])[ \t]+/

// The text into the editor's document.
export function parseText(text: string): Node {
  const flags = formatFlags(text)
  const blocks: Node[] = []
  let at = 0
  for (const ln of text.split("\n")) {
    const end = at + ln.length
    let type = schema.nodes.paragraph
    let attrs: Record<string, unknown> = {}
    let skip = 0
    let m: RegExpExecArray | null
    if (ln && flags[at] & RULE) {
      blocks.push(schema.nodes.rule.create({ text: ln }))
      at = end + 1
      continue
    } else if ((m = HEADING.exec(ln))) {
      type = schema.nodes.heading
      attrs = { level: m[1].length }
      skip = m[0].length
    } else if (flags[at] & QUOTE && (m = QUOTE_START.exec(ln))) {
      type = schema.nodes.quote
      attrs = { space: m[1].length > 0 }
      skip = m[0].length
    } else if (
      (m = BULLET_START.exec(ln)) &&
      flags[at + m[1].length] & BULLET
    ) {
      type = schema.nodes.bullet
      attrs = { indent: m[1], mark: m[2] }
      skip = m[0].length
    } else if ((m = NUMBERED_START.exec(ln))) {
      type = schema.nodes.numbered
      attrs = { indent: m[1], n: Number(m[2]), sep: m[3] }
      skip = m[0].length
    }
    // the words, without their markers, in runs of the same formatting
    const inline: Node[] = []
    let run = ""
    let runMarks: readonly Mark[] = []
    let runKey = -1
    const flush = () => {
      if (run) inline.push(schema.text(run, runMarks))
      run = ""
    }
    for (let i = at + skip; i < end; i++) {
      const f = flags[i]
      if (f & MARKER) continue
      const key = f & (BOLD | ITALIC | UNDERLINE | STRIKE)
      if (key !== runKey) {
        flush()
        runKey = key
        runMarks = Mark.setFrom(marksFor(key, text, i, flags))
      }
      run += text[i]
    }
    flush()
    blocks.push(type.create(attrs, inline))
    at = end + 1
  }
  return schema.nodes.doc.create(null, blocks)
}

// the marks for a run's flags (italic remembers its marker: the first
// character of its italic stretch, which is its opening "*" or "_")
function marksFor(key: number, text: string, i: number, flags: Uint16Array) {
  const marks: Mark[] = []
  if (key & BOLD) marks.push(schema.marks.bold.create())
  if (key & UNDERLINE) marks.push(schema.marks.underline.create())
  if (key & STRIKE) marks.push(schema.marks.strike.create())
  if (key & ITALIC) {
    let j = i
    while (j > 0 && flags[j - 1] & ITALIC) j--
    marks.push(
      schema.marks.italic.create({ marker: text[j] === "*" ? "*" : "_" }),
    )
  }
  return marks
}

// The document back into text, with the maps between the two:
// `toPos[offset]` is the place in the editor for a place in the text;
// `startAt[pos]` the place in the text where what follows `pos` starts,
// and `endAt[pos]` where what comes before it ends (they differ where
// markers sit between).
export type Serialized = {
  text: string
  toPos: number[]
  startAt: number[]
  endAt: number[]
}

// the order markers open in (bold outermost, italic innermost), so a
// closing one is always the last opened
const ORDER = ["bold", "underline", "strike", "italic"] as const
type MarkName = (typeof ORDER)[number]
const MARKER_OF: Record<Exclude<MarkName, "italic">, string> = {
  bold: "**",
  underline: "__",
  strike: "~~",
}

export function serializeDoc(doc: Node): Serialized {
  let text = ""
  const toPos: number[] = []
  const size = doc.content.size
  const startAt = new Array<number>(size + 1).fill(-1)
  const endAt = new Array<number>(size + 1).fill(-1)
  const emit = (s: string, pos: number) => {
    text += s
    for (let k = 0; k < s.length; k++) toPos.push(pos)
  }

  doc.forEach((block, offset, index) => {
    const lineStart = text.length
    // the place before the block, and where its words start
    const open = offset
    const cs = offset + 1
    startAt[open] = endAt[open] = lineStart
    if (block.type.name === "rule") {
      emit(block.attrs.text as string, open)
      startAt[open + 1] = endAt[open + 1] = text.length
    } else {
      const a = block.attrs
      const prefix =
        block.type.name === "heading"
          ? `${"#".repeat(a.level)} `
          : block.type.name === "quote"
            ? a.space
              ? "> "
              : ">"
            : block.type.name === "bullet"
              ? `${a.indent}${a.mark} `
              : block.type.name === "numbered"
                ? `${a.indent}${a.n}${a.sep} `
                : ""
      emit(prefix, cs)
      // each character with its marks (whitespace at a mark's edges is
      // left outside it, so the text reads back the same)
      const chars: { ch: string; marks: Set<MarkName>; star: boolean }[] = []
      block.forEach((child) => {
        const names = new Set<MarkName>()
        let star = false
        for (const m of child.marks) {
          names.add(m.type.name as MarkName)
          if (m.type.name === "italic") star = m.attrs.marker === "*"
        }
        for (const ch of child.text ?? "")
          chars.push({ ch, marks: new Set(names), star })
      })
      for (const name of ORDER) {
        let k = 0
        while (k < chars.length) {
          if (!chars[k].marks.has(name)) {
            k++
            continue
          }
          let e = k
          while (e < chars.length && chars[e].marks.has(name)) e++
          let s = k
          while (s < e && /\s/.test(chars[s].ch)) chars[s++].marks.delete(name)
          let t = e - 1
          while (t >= s && /\s/.test(chars[t].ch)) chars[t--].marks.delete(name)
          k = e
        }
      }
      const stack: { name: MarkName; marker: string }[] = []
      const closeTo = (depth: number, pos: number) => {
        while (stack.length > depth) emit(stack.pop()!.marker, pos)
      }
      startAt[cs] = -1
      endAt[cs] = text.length
      chars.forEach((c, k) => {
        const pos = cs + k
        // close back to the first marker that's no longer wanted
        const keep = stack.findIndex((o) => !c.marks.has(o.name))
        if (keep >= 0) closeTo(keep, pos)
        for (const name of ORDER) {
          if (!c.marks.has(name) || stack.some((o) => o.name === name)) continue
          // italic beside an underline's "__" uses "*", so they stay apart
          const marker =
            name === "italic"
              ? c.star || c.marks.has("underline")
                ? "*"
                : "_"
              : MARKER_OF[name]
          emit(marker, pos)
          stack.push({ name, marker })
        }
        startAt[pos] = text.length
        emit(c.ch, pos)
        endAt[pos + 1] = text.length
      })
      closeTo(0, cs + chars.length)
      // the end of the block's words: the end of its line
      startAt[cs + chars.length] = text.length
      if (chars.length === 0) endAt[cs] = text.length
    }
    if (index < doc.childCount - 1)
      emit("\n", offset + block.nodeSize - (block.isLeaf ? 0 : 1))
  })
  toPos.push(Math.max(0, size - 1))
  // the places between blocks: where the next line starts
  for (let p = size; p >= 0; p--) {
    if (startAt[p] < 0) startAt[p] = p < size ? startAt[p + 1] : text.length
  }
  for (let p = 0; p <= size; p++) {
    if (endAt[p] < 0) endAt[p] = p > 0 ? endAt[p - 1] : 0
  }
  return { text, toPos, startAt, endAt }
}
