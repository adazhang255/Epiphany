"use client"

// The box you write an entry in: its formatting shown as it will look
// (bold is bold, a heading a heading), never the Markdown markers. The
// entry is still kept as its text, written the Markdown way (see
// lib/markdown and lib/richDoc): `value` in, `onChange` out, and
// highlights and selections given as places in that text.
//
// Formatting: the buttons (FormatBar) and ⌘B / ⌘I / ⌘U / ⌘⇧X, ⌘⇧8 bullets,
// ⌘⇧7 numbers, ⌘⌥1 heading, ⌘⇧. quote; or type it the Markdown way
// (**bold**, *italic*, # heading, - bullet, 1. number, > quote, --- a
// divider) and it turns into the formatting. Punctuation as you type: "--"
// an em dash, "..." an ellipsis, curly quotes, arrows (see
// lib/smartPunctuation). Backspace straight after any of these puts back
// what you typed.

import "prosemirror-view/style/prosemirror.css"
import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react"
import {
  EditorState,
  Plugin,
  TextSelection,
  type Command,
  type Transaction,
} from "prosemirror-state"
import { Decoration, DecorationSet, EditorView } from "prosemirror-view"
import { Slice, type MarkType, type NodeType } from "prosemirror-model"
import { history, redo, undo } from "prosemirror-history"
import { keymap } from "prosemirror-keymap"
import {
  baseKeymap,
  chainCommands,
  setBlockType,
  toggleMark,
} from "prosemirror-commands"
import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  undoInputRule,
} from "prosemirror-inputrules"
import {
  parseText,
  schema,
  serializeDoc,
  type Serialized,
} from "@/features/notes/lib/richDoc"
import { smarten } from "@/features/notes/lib/smartPunctuation"
import { follow, tint, type Range } from "@/features/notes/lib/ranges"

const N = schema.nodes
const M = schema.marks

// ---- formatting commands ----------------------------------------------

export type Tool =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "heading"
  | "bullet"
  | "numbered"
  | "quote"
  | "rule"

// the lines (textblocks) the selection touches, and where each starts
function selectedLines(state: EditorState) {
  const { from, to } = state.selection
  const lines: { node: import("prosemirror-model").Node; pos: number }[] = []
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      lines.push({ node, pos })
      return false
    }
    return true
  })
  return lines
}

// Make the selected lines bullets / numbered / quotes, or plain again if
// they all are already (numbered ones counted 1, 2, 3… down the selection).
const toggleLines =
  (type: NodeType): Command =>
  (state, dispatch) => {
    const lines = selectedLines(state)
    if (!lines.length) return false
    const all = lines.every((l) => l.node.type === type)
    if (dispatch) {
      const tr = state.tr
      lines.forEach(({ node, pos }, i) => {
        const indent = (node.attrs.indent as string | undefined) ?? ""
        if (all) tr.setNodeMarkup(pos, N.paragraph)
        else if (type === N.numbered)
          tr.setNodeMarkup(pos, type, { indent, n: i + 1, sep: "." })
        else if (type === N.bullet)
          tr.setNodeMarkup(pos, type, { indent, mark: "-" })
        else tr.setNodeMarkup(pos, type)
      })
      dispatch(tr)
    }
    return true
  }

// Heading, then a smaller one, then plain again (from the first line).
const cycleHeading: Command = (state, dispatch) => {
  const lines = selectedLines(state)
  if (!lines.length) return false
  const first = lines[0].node
  const level = first.type === N.heading ? (first.attrs.level as number) : 0
  if (dispatch) {
    const tr = state.tr
    for (const { pos } of lines)
      if (level === 0) tr.setNodeMarkup(pos, N.heading, { level: 1 })
      else if (level === 1) tr.setNodeMarkup(pos, N.heading, { level: 2 })
      else tr.setNodeMarkup(pos, N.paragraph)
    dispatch(tr)
  }
  return true
}

// A divider after the line you're on, the cursor on a line after it.
const insertRule: Command = (state, dispatch) => {
  const { $from } = state.selection
  if (dispatch) {
    const after = $from.after(1)
    const empty = $from.parent.content.size === 0
    const tr = state.tr
    // (an empty line becomes the divider)
    const at = empty ? $from.before(1) : after
    if (empty) tr.delete($from.before(1), after)
    tr.insert(at, [N.rule.create(), N.paragraph.create()])
    tr.setSelection(TextSelection.create(tr.doc, at + 2))
    dispatch(tr.scrollIntoView())
  }
  return true
}

const TOOL_COMMANDS: Record<Tool, Command> = {
  bold: toggleMark(M.bold),
  italic: toggleMark(M.italic, { marker: "_" }),
  underline: toggleMark(M.underline),
  strike: toggleMark(M.strike),
  heading: cycleHeading,
  bullet: toggleLines(N.bullet),
  numbered: toggleLines(N.numbered),
  quote: toggleLines(N.quote),
  rule: insertRule,
}

// Enter on a bullet, numbered or quote line: the next one (the next
// number); on an empty one, the list ends there.
const continueList: Command = (state, dispatch) => {
  const { $from, $to } = state.selection
  const node = $from.parent
  if (
    !$from.sameParent($to) ||
    ![N.bullet, N.numbered, N.quote].includes(node.type)
  )
    return false
  if (dispatch) {
    if (node.content.size === 0) {
      dispatch(state.tr.setBlockType($from.pos, $from.pos, N.paragraph))
      return true
    }
    const tr = state.tr.deleteSelection()
    const attrs =
      node.type === N.numbered
        ? { ...node.attrs, n: (node.attrs.n as number) + 1 }
        : node.attrs
    tr.split(tr.selection.from, 1, [{ type: node.type, attrs }])
    dispatch(tr.scrollIntoView())
  }
  return true
}

// Backspace at the very start of a heading, list or quote line: it becomes
// a plain line (another Backspace joins it to the one above).
const plainAtStart: Command = (state, dispatch) => {
  const { $from, empty } = state.selection
  if (!empty || $from.parentOffset > 0 || $from.parent.type === N.paragraph)
    return false
  return setBlockType(N.paragraph)(state, dispatch)
}

// ---- typing it the Markdown way ------------------------------------------

// **words** (and the others) turn into the formatting as you close them
function markRule(re: RegExp, mark: MarkType, open: number, attrs = {}) {
  return new InputRule(re, (state, match, start, end) => {
    const inner = match[1]
    const tr = state.tr
    // in the document: the opening marker, the words, the closing marker
    // but for the character just typed
    tr.delete(start + open + inner.length, end)
    tr.delete(start, start + open)
    tr.addMark(start, start + inner.length, mark.create(attrs))
    tr.removeStoredMark(mark)
    return tr
  })
}

const WORDS = "([^\\s{m}](?:[^\\n{m}]*[^\\s{m}])?)"
const words = (m: string) => WORDS.replaceAll("{m}", m)

const rules = [
  // a line of "---" (the first two already an em dash): a divider
  new InputRule(/^—-$/, (state, _match, start) => {
    const $start = state.doc.resolve(start)
    if ($start.parent.type !== N.paragraph) return null
    const from = $start.before()
    const tr = state.tr.replaceWith(from, $start.after(), [
      N.rule.create(),
      N.paragraph.create(),
    ])
    return tr.setSelection(TextSelection.create(tr.doc, from + 2))
  }),
  markRule(new RegExp(`\\*\\*${words("*")}\\*\\*$`), M.bold, 2),
  markRule(new RegExp(`~~${words("~")}~~$`), M.strike, 2),
  markRule(
    new RegExp(`(?<![\\p{L}\\p{N}_])__${words("_")}__$`, "u"),
    M.underline,
    2,
  ),
  markRule(
    new RegExp(`(?<![\\p{L}\\p{N}*])\\*${words("*")}\\*$`, "u"),
    M.italic,
    1,
    {
      marker: "*",
    },
  ),
  markRule(
    new RegExp(`(?<![\\p{L}\\p{N}_])_${words("_")}_$`, "u"),
    M.italic,
    1,
    {
      marker: "_",
    },
  ),
  textblockTypeInputRule(/^#\s$/, N.heading, { level: 1 }),
  textblockTypeInputRule(/^##\s$/, N.heading, { level: 2 }),
  textblockTypeInputRule(/^###\s$/, N.heading, { level: 3 }),
  textblockTypeInputRule(/^>\s$/, N.quote),
  textblockTypeInputRule(/^([-*])\s$/, N.bullet, (m) => ({ mark: m[1] })),
  textblockTypeInputRule(/^(\d+)([.)])\s$/, N.numbered, (m) => ({
    n: Number(m[1]),
    sep: m[2],
  })),
  // punctuation (see lib/smartPunctuation): one character typed at a time
  new InputRule(/[\s\S]{0,4}$/, (state, match, start, end, text) => {
    if (text.length !== 1) return null
    const before = match[0].slice(0, match[0].length - text.length)
    const s = smarten(before, text)
    if (!s) return null
    return state.tr.insertText(s.insert, end - s.remove, end)
  }),
]

// ---- the component ---------------------------------------------------------

// a place in the text being written: a selection, the cursor in it
export type TextSelectionInfo = { start: number; end: number; caret: number }

export type RichHandle = {
  run: (tool: Tool) => void
  focus: () => void
  // where a place in the text is on screen (for a picker beside it)
  rectAt: (offset: number) => DOMRect | null
}

export type Tint = Range & { color: string }

export function RichText({
  value,
  onChange,
  tints = [],
  onSelect,
  placeholder = "",
  ariaLabel,
  autoFocus,
  className = "",
  handle,
  id,
}: {
  value: string
  onChange: (text: string) => void
  // highlights to tint, as places in `value`
  tints?: Tint[]
  // the selection, as places in the text (null: none, or not in the box)
  onSelect?: (sel: TextSelectionInfo | null) => void
  placeholder?: string
  ariaLabel?: string
  autoFocus?: boolean
  className?: string
  handle?: React.Ref<RichHandle>
  id?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // the text as the editor writes it now, with its maps
  const ser = useRef<Serialized | null>(null)
  // texts it handed out lately (a `value` that's one of these is the page
  // catching up with what's in the box, not a new text)
  const sent = useRef<string[]>([])
  // the latest props, read from inside the editor
  const latest = useRef({ value, onChange, onSelect, tints, placeholder })
  useLayoutEffect(() => {
    latest.current = { value, onChange, onSelect, tints, placeholder }
  })

  useEffect(() => {
    const el = host.current
    if (!el) return
    const decorations = new Plugin({
      props: {
        decorations(state) {
          const s = ser.current
          if (!s) return null
          const { tints, value, placeholder } = latest.current
          const decos: Decoration[] = []
          // the highlights, from places in `value` to places in what the
          // editor has (the same text, unless it was just tidied)
          const ranges = Object.fromEntries(tints.map((t, i) => [i, t]))
          const now = value === s.text ? ranges : follow(ranges, value, s.text)
          tints.forEach((t, i) => {
            const r = now[i]
            if (!r) return
            const from = s.toPos[r.start]
            const to = s.toPos[r.end]
            if (from === undefined || to === undefined || to <= from) return
            decos.push(
              Decoration.inline(from, to, {
                style: `background:${tint(t.color, 0.22)};box-shadow:inset 0 -2px 0 ${tint(t.color, 0.85)}`,
                class: "rounded-sm",
              }),
            )
          })
          const first = state.doc.firstChild
          if (
            placeholder &&
            state.doc.childCount === 1 &&
            first?.type === N.paragraph &&
            first.content.size === 0
          )
            decos.push(
              Decoration.node(0, first.nodeSize, {
                class: "rt-empty",
                "data-placeholder": placeholder,
              }),
            )
          return DecorationSet.create(state.doc, decos)
        },
      },
    })

    const doc = parseText(latest.current.value)
    ser.current = serializeDoc(doc)
    const state = EditorState.create({
      doc,
      plugins: [
        inputRules({ rules }),
        keymap({
          "Mod-b": TOOL_COMMANDS.bold,
          "Mod-i": TOOL_COMMANDS.italic,
          "Mod-u": TOOL_COMMANDS.underline,
          "Mod-Shift-x": TOOL_COMMANDS.strike,
          "Mod-Shift-8": TOOL_COMMANDS.bullet,
          "Mod-Shift-7": TOOL_COMMANDS.numbered,
          "Mod-Alt-1": TOOL_COMMANDS.heading,
          "Mod-Shift-.": TOOL_COMMANDS.quote,
          "Mod-z": undo,
          "Mod-Shift-z": redo,
          "Mod-y": redo,
          Enter: continueList,
          Backspace: chainCommands(undoInputRule, plainAtStart),
        }),
        keymap(baseKeymap),
        history(),
        decorations,
      ],
    })

    const report = (v: EditorView) => {
      const s = ser.current
      const onSelect = latest.current.onSelect
      if (!s || !onSelect) return
      if (!v.hasFocus()) return onSelect(null)
      const { from, to, head, empty } = v.state.selection
      const start = empty ? s.startAt[from] : s.startAt[from]
      const end = empty ? start : s.endAt[to]
      onSelect({ start, end, caret: head === to && !empty ? end : start })
    }

    const v = new EditorView(el, {
      state,
      attributes: {
        class: "rt-text",
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        ...(id ? { id } : {}),
      },
      // pasted plain text is read the Markdown way too
      clipboardTextParser: (text) => {
        const d = parseText(text.replace(/\r\n?/g, "\n"))
        return new Slice(d.content, 1, 1)
      },
      dispatchTransaction(tr: Transaction) {
        const next = v.state.apply(tr)
        v.updateState(next)
        if (tr.docChanged) {
          ser.current = serializeDoc(next.doc)
          latest.current.value = ser.current.text
          sent.current = [...sent.current.slice(-30), ser.current.text]
          latest.current.onChange(ser.current.text)
        }
        report(v)
      },
      handleDOMEvents: {
        focus: (v) => {
          report(v)
          return false
        },
        blur: (v) => {
          // (a click on a picker beside the box keeps what was selected)
          setTimeout(() => {
            if (
              !v.hasFocus() &&
              !document.activeElement?.closest("[role=dialog]")
            )
              latest.current.onSelect?.(null)
          }, 0)
          return false
        },
      },
    })
    view.current = v
    if (autoFocus) v.focus()
    return () => {
      v.destroy()
      view.current = null
    }
    // (made once; later props are read through `latest`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a new text from outside (a draft brought back, the box emptied after
  // saving): the editor starts over from it
  useEffect(() => {
    const v = view.current
    if (!v || value === ser.current?.text || sent.current.includes(value))
      return
    sent.current = []
    const doc = parseText(value)
    const tr = v.state.tr
      .replaceWith(0, v.state.doc.content.size, doc.content)
      .setMeta("addToHistory", false)
    ser.current = serializeDoc(tr.doc)
    v.updateState(v.state.apply(tr))
  }, [value])

  // the highlights (or placeholder) changed: drawn again
  useEffect(() => {
    view.current?.setProps({})
  }, [tints, placeholder])

  useImperativeHandle(
    handle,
    (): RichHandle => ({
      run: (tool) => {
        const v = view.current
        if (!v) return
        TOOL_COMMANDS[tool](v.state, v.dispatch)
        v.focus()
      },
      focus: () => view.current?.focus(),
      rectAt: (offset) => {
        const v = view.current
        const s = ser.current
        if (!v || !s) return null
        const pos = s.toPos[Math.min(offset, s.toPos.length - 1)]
        try {
          const c = v.coordsAtPos(pos)
          return new DOMRect(c.left, c.top, c.right - c.left, c.bottom - c.top)
        } catch {
          return null
        }
      },
    }),
    [],
  )

  return <div ref={host} className={className} />
}
