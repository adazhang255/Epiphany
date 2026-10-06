// Which way Ask handles a message.
//  - "tools": find, delete or add entries, or rename threads and take
//    passages out of them. Answered by a tool-calling model; every change is
//    only ever proposed (see tools.ts).
//  - an unsupported change ("merge these", "tag them"): Ask can't do it yet,
//    so the reply is flagged and the model is reminded not to pretend.
//  - otherwise a normal reflective question.

const TARGETS = /\b(entr(y|ies)|notes?|posts?|these|those|them|all|ones)\b/i

const TOOL_VERBS =
  /\b(delete|remove|erase|get rid of|clean up|add|create|save|new entry|new note|find|list|show me|search|look up|which|how many|count)\b/i

const UNSUPPORTED_VERBS =
  /\b(merge|combine|rename|retitle|re-?tag|untag|tag|publish|unpublish|archive|edit|rewrite|move)\b/i

// threads: the assistant can find them, and propose renaming one or taking a
// passage out of one
const THREADS = /\bthreads?\b/i
const THREAD_VERBS =
  /\b(rename|retitle|call|name|remove|take|drop|delete|find|list|show|which|how many)\b/i

const DELETE_VERBS = /\b(delete|remove|erase|get rid of|clean up)\b/i

// Asked to delete something (still only ever proposed, then confirmed).
// (Taking something out of a thread isn't deleting an entry.)
export function wantsDelete(text: string) {
  return DELETE_VERBS.test(text) && TARGETS.test(text) && !THREADS.test(text)
}

export const aboutThreads = (text: string) =>
  THREADS.test(text) && THREAD_VERBS.test(text)

export function needsTools(text: string) {
  return (TOOL_VERBS.test(text) && TARGETS.test(text)) || aboutThreads(text)
}

// The change asked for, when Ask can't make it (e.g. "merge"), else null.
export function actionRequest(text: string) {
  if (aboutThreads(text)) return null
  const verb = text.match(UNSUPPORTED_VERBS)?.[0]
  return verb && TARGETS.test(text) ? verb.toLowerCase() : null
}

// What a request about a thread asks for: a new name ("rename the X thread
// to Y"), or taking a passage out. Null if neither is clear.
export function threadIntent(
  text: string,
): { action: "rename"; name: string } | { action: "remove" } | null {
  if (!THREADS.test(text)) return null
  if (/\b(rename|retitle|call|name)\b/i.test(text)) {
    const name = text
      .match(/\b(?:to|as)\s+(.+?)\s*$/i)?.[1]
      ?.replace(/^["“'‘]|["”'’]?[.!?]?$/g, "")
      .trim()
    return name ? { action: "rename", name } : null
  }
  if (/\b(remove|take|drop|delete)\b/i.test(text)) return { action: "remove" }
  return null
}
