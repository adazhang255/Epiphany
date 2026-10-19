// Ask answers, made into Markdown the Ask page renders (AnswerMarkdown).

// citation links (#cite-4-5 for "[4, 5]") and the typing cursor
export const CITE = "#cite-"
export const CURSOR = "#cursor"

// What small models write, made into Markdown the renderer reads: a whole
// reply wrapped in a ```markdown block is unwrapped, "•" bullets become list
// items, and "[2]" or "[4, 5]" citations become links drawn as chips to the
// entries. Code is left as written.
export function prepareAnswer(text: string) {
  const unwrapped = text.replace(
    /^\s*```(?:markdown|md)?[ \t]*\n([\s\S]*?)(?:\n```\s*)?$/i,
    "$1",
  )
  return unwrapped
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(/^(\s*)[•●▪◦–]\s+/gm, "$1- ")
            .replace(
              /\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g,
              (_, nums: string) =>
                `[${nums}](${CITE}${nums.split(/\s*,\s*/).join("-")})`,
            ),
    )
    .join("")
}
