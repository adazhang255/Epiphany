// Typographer's punctuation as you type: "--" becomes an em dash, "..." an
// ellipsis, straight quotes curly ones, "->" an arrow, and so on. Worked out
// on the text alone: given the text before the cursor and the character
// just typed, what to put in place of the end of it (null: type it as is).

export type Smartened = {
  // how many characters before the cursor it replaces (as well as the one
  // typed, which is never put in)
  remove: number
  insert: string
}

// the character typed, after what's already there → what they become
const PAIRS: [typed: string, before: string, insert: string][] = [
  ["-", "-", "—"], // em dash
  ["-", "<", "←"],
  ["-", "+", "±"],
  [".", "..", "…"],
  [">", "-", "→"],
  [">", "=", "⇒"],
  ["=", "<", "≤"],
  ["=", ">", "≥"],
  ["=", "!", "≠"],
  [")", "(c", "©"],
  [")", "(C", "©"],
  [")", "(r", "®"],
  [")", "(R", "®"],
  [")", "(tm", "™"],
  [")", "(TM", "™"],
]

// a quote opens after nothing, a space or an opening bracket or dash
const OPENS_AFTER = /(^|[\s([{—–‘“-])$/

export function smarten(before: string, typed: string): Smartened | null {
  if (typed === '"')
    return { remove: 0, insert: OPENS_AFTER.test(before) ? "“" : "”" }
  if (typed === "'")
    return { remove: 0, insert: OPENS_AFTER.test(before) ? "‘" : "’" }
  for (const [t, b, insert] of PAIRS)
    // (a third dash, after "—", stays a dash: "—-" on a line of its own is
    // a divider, see lib/markdown)
    if (t === typed && before.endsWith(b)) return { remove: b.length, insert }
  return null
}
