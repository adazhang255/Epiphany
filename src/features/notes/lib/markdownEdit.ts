// The edits behind the formatting buttons (see FormatBar), worked out on
// the text alone: given the text and what's selected, what to put where,
// and what to select after. null = nothing to do.

export type TextEdit = {
  start: number
  end: number
  insert: string
  // the selection afterwards
  from: number
  to: number
}

// Wrap the selection in `mark` (** or *), or unwrap it if it already is.
export function toggleWrap(
  v: string,
  selStart: number,
  selEnd: number,
  mark: "**" | "*",
): TextEdit {
  let s = selStart
  let e = selEnd
  // not the spaces at its edges (a double-click can take one)
  while (s < e && /\s/.test(v[s])) s++
  while (e > s && /\s/.test(v[e - 1])) e--
  const n = mark.length
  const inside = v.slice(s, e)
  // already wrapped? (a "*" that's half of a bold "**" isn't italic's)
  const wrapped =
    s >= n &&
    (n === 2
      ? v.slice(s - 2, s) === "**" && v.slice(e, e + 2) === "**"
      : v[s - 1] === "*" &&
        (v[s - 2] !== "*" || v.slice(s - 3, s) === "***") &&
        v[e] === "*" &&
        (v[e + 1] !== "*" || v.slice(e, e + 3) === "***"))
  if (wrapped)
    return { start: s - n, end: e + n, insert: inside, from: s - n, to: e - n }
  // the selection takes in the markers too
  if (
    inside.length > 2 * n &&
    inside.startsWith(mark) &&
    inside.endsWith(mark) &&
    (n === 2 || !inside.startsWith("**") || inside.startsWith("***"))
  )
    return {
      start: s,
      end: e,
      insert: inside.slice(n, -n),
      from: s,
      to: e - 2 * n,
    }
  if (s === e)
    return { start: s, end: e, insert: mark + mark, from: s + n, to: s + n }
  return {
    start: s,
    end: e,
    insert: mark + inside + mark,
    from: s + n,
    to: e + n,
  }
}

const BULLET = /^(\s*)[-*][ \t]+/

// Make the selected lines bullets, or plain lines if they all are already.
export function toggleBullets(
  v: string,
  selStart: number,
  selEnd: number,
): TextEdit {
  const start = v.lastIndexOf("\n", selStart - 1) + 1
  // a selection ending just after a line break doesn't take the next line
  const last = selEnd > selStart && v[selEnd - 1] === "\n" ? selEnd - 1 : selEnd
  const nl = v.indexOf("\n", Math.max(last, start))
  const end = nl < 0 ? v.length : nl
  const lines = v.slice(start, end).split("\n")
  if (lines.length === 1 && !lines[0].trim())
    return { start, end, insert: "- ", from: start + 2, to: start + 2 }
  const filled = lines.filter((l) => l.trim())
  const all = filled.every((l) => BULLET.test(l))
  const next = lines
    .map((l) =>
      all
        ? l.replace(BULLET, "$1")
        : l.trim() && !BULLET.test(l)
          ? `- ${l}`
          : l,
    )
    .join("\n")
  return { start, end, insert: next, from: start, to: start + next.length }
}

// Enter on a bullet line: the next bullet, or (on an empty one) the end of
// the list. null if the line isn't a bullet.
export function continueList(
  v: string,
  selStart: number,
  selEnd: number,
): TextEdit | null {
  if (selStart !== selEnd) return null
  const at = selStart
  const start = v.lastIndexOf("\n", at - 1) + 1
  const m = /^(\s*)([-*])[ \t]+(.*)$/.exec(v.slice(start, at))
  if (!m) return null
  // an empty bullet: the list ends, the line is left blank
  if (!m[3].trim() && !v.slice(at).split("\n")[0].trim())
    return { start, end: at, insert: "", from: start, to: start }
  const bullet = `\n${m[1]}${m[2]} `
  return {
    start: at,
    end: at,
    insert: bullet,
    from: at + bullet.length,
    to: at + bullet.length,
  }
}
