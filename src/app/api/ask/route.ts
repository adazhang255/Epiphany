import {
  aboutThreads,
  actionRequest,
  needsTools,
  threadIntent,
  wantsDelete,
} from "@/features/ask/actions"
import { findSources } from "@/features/ask/retrieve"
import {
  bestPassage,
  findThreads,
  runTool,
  TOOLS,
  type ProposalView,
  type ToolContext,
} from "@/features/ask/tools"
import {
  chatStream,
  chatTools,
  OllamaUnavailableError,
  pickAskModel,
  pickToolModel,
  type ToolChatMessage,
} from "@/features/notes/services/ollama.service"

type Message = { role: "user" | "assistant"; content: string }

const SYSTEM_PROMPT = `You are a thoughtful companion helping someone reflect on their own private journal. You only know what is in the journal entries provided below.
- Answer using ONLY these entries. Cite them inline like [1] or [2][3]. Never invent entries, dates or details.
- If the entries don't answer the question, say so plainly and suggest what they could write about instead.
- Pay attention to dates: point out when their thinking changed over time.
- Speak to them as "you". Be warm, honest and brief (under 170 words).
- Then end with ONE open, gentle question that invites them to reflect further or keep writing. Ask it; don't answer it.
- You are not a therapist: don't diagnose. If they seem to be in crisis or unsafe, kindly encourage them to reach out to someone they trust or a professional.
- You can only read the journal. You cannot delete, edit, merge, tag or publish entries. If asked to, say briefly that you can't change entries yet, then help by pointing to the entries that seem to fit, so they can do it themselves. Never claim to have changed anything.`

const TOOL_PROMPT = (
  today: string,
) => `You help someone look after their private journal, using tools. Today is ${today}.
- To find entries, call findEntries. If they name an entry or a title (often in quotes), use titleContains with that title and nothing else. For short or nearly empty entries use maxWords (e.g. 5). Use textContains for exact words, after/before for dates, about for a theme.
- Match their request narrowly: a delete must only include entries they described.
- To delete entries: FIRST call findEntries with filters that match only those entries, THEN call deleteEntries (no ids needed: it proposes what findEntries just returned). This only PROPOSES the deletion; the person reviews and confirms it in the app. Never say anything was deleted.
- To add entries: call addEntries with exactly the words the person gave you. Never invent their writing. This only PROPOSES it; they confirm in the app. Never say anything was saved.
- Threads group passages from different days about one idea. To rename a thread or take a passage out of one: FIRST call findThreads (about = words from the thread's title or passages), THEN call renameThread or removeFromThread with the numbers it gave. These only PROPOSE the change; the person confirms in the app. Never say anything was renamed or removed.
- You cannot edit, merge, tag or publish entries.
- Finish with a short reply (under 80 words): what you found or proposed, entries by title and date. Never show ids. If you proposed a change, ask them to review it below and confirm if it's right.`

// Most tool calls one question may make before the model must answer.
const MAX_STEPS = 4

function sourceBlock(
  sources: Awaited<ReturnType<typeof findSources>>["sources"],
) {
  if (sources.length === 0) return "No journal entries matched this question."
  return sources
    .map(
      (s) =>
        `[${s.n}] "${s.title || "Untitled"}" (${new Date(s.date).toDateString()}${
          s.category ? `, ${s.category}` : ""
        })\n${s.content}`,
    )
    .join("\n\n---\n\n")
}

// Ask your journal: find related entries, then stream an answer from the
// local model. Streams newline-delimited JSON:
//   {"status":"reading"|"thinking"|"proposing"} whenever the stage changes,
//   {"sources":[…]}  then  {"t":"text"}…  then  {"done":true}  (or {"error":…})
// Nothing about the conversation is stored.
export async function POST(req: Request) {
  let messages: Message[]
  try {
    const body = await req.json()
    messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(
        (m: Message) =>
          (m?.role === "user" || m?.role === "assistant") &&
          typeof m.content === "string",
      )
      .slice(-10)
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }
  const userTurns = messages.filter((m) => m.role === "user")
  if (userTurns.length === 0) {
    return Response.json({ error: "Ask something first" }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"))
      try {
        const latestText = messages.at(-1)!.content
        if (needsTools(latestText)) {
          const action = actionRequest(latestText)
          if (action) send({ action })
          await answerWithTools(messages, req.signal, send)
          return
        }

        // follow-ups ("what about later?") lean on the previous question too
        const query = userTurns
          .slice(-2)
          .map((m) => m.content)
          .join("\n")
        send({ status: "reading" })
        const { sources, unembedded } = await findSources(query)
        const action = actionRequest(messages.at(-1)!.content)
        if (action) send({ action })
        send({
          sources: sources.map(({ n, id, title, date, category }) => ({
            n,
            id,
            title,
            date,
            category,
          })),
          unembedded,
        })

        send({ status: "thinking" })
        const model = await pickAskModel()
        const latest = messages.at(-1)!
        const prompt = [
          {
            role: "system" as const,
            content: `${SYSTEM_PROMPT}\n\nJournal entries:\n\n${sourceBlock(sources)}`,
          },
          ...messages.slice(0, -1),
          {
            role: "user" as const,
            // small models skim the system prompt; repeat the limit right
            // where they look, so they don't "remove" entries in the reply
            content: action
              ? `${latest.content}\n\n(Reminder: you cannot ${action} or change entries, and nothing has been changed. Do not reprint or rewrite the entries. Say in one sentence that you can't do this yet, then list which entries above seem to fit the request, by number, with a few words on why.)`
              : latest.content,
          },
        ]
        for await (const text of chatStream(prompt, {
          model,
          signal: req.signal,
        })) {
          if (req.signal.aborted) break
          send({ t: text })
        }
        if (!req.signal.aborted) send({ done: true, model })
      } catch (error) {
        // stopped by the person: nothing to report, nobody is listening
        if (req.signal.aborted) return
        send({
          error:
            error instanceof OllamaUnavailableError
              ? error.message
              : "Something went wrong while answering.",
        })
        if (!(error instanceof OllamaUnavailableError))
          console.error("[ask]", error)
      } finally {
        try {
          controller.close()
        } catch {
          // already closed because the client went away
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

// Tool mode: let the model call tools (shown to the person as they run),
// feed back the results, and send its final reply. Changes come back only as
// proposals for the person to confirm; nothing here writes to the journal.
async function answerWithTools(
  messages: Message[],
  signal: AbortSignal,
  send: (data: object) => void,
) {
  const model = await pickToolModel()
  // what the tools did, to describe it if the model's own reply is unusable
  const done: string[] = []
  let proposed = false
  const ctx: ToolContext = {
    seen: new Set(),
    lastFound: [],
    lastThreads: [],
    emit: (event) => {
      const e = event as {
        found?: unknown[]
        proposal?: ProposalView
      }
      if (e.found)
        done.push(
          `Found ${e.found.length} matching ${e.found.length === 1 ? "entry" : "entries"}.`,
        )
      if (e.proposal) {
        proposed = true
        const p = e.proposal
        const what =
          p.kind === "thread"
            ? p.change.action === "rename"
              ? `renaming the thread “${p.change.from}” to “${p.change.to}”`
              : `taking a passage out of the thread “${p.change.title}”`
            : `${p.kind === "delete" ? "deleting" : "adding"} ${p.entries.length} ${p.entries.length === 1 ? "entry" : "entries"}`
        done.push(
          `I've proposed ${what}. Nothing has changed yet: review it below and confirm if it's right.`,
        )
      }
      send(event)
    },
  }
  const now = new Date()
  const today = `${now.toDateString()} (${now.toISOString().slice(0, 10)})`
  const chat: ToolChatMessage[] = [
    { role: "system", content: TOOL_PROMPT(today) },
    ...messages,
  ]
  send({ sources: [], unembedded: 0 })

  // About a thread: look the threads up first (small models tend to skip
  // this and guess a number), and hand the model the numbered list.
  const latest = messages.at(-1)!.content
  if (aboutThreads(latest)) {
    // a new name says nothing about which thread is meant
    const intent = threadIntent(latest)
    const args = {
      about:
        intent?.action === "rename"
          ? latest.slice(0, latest.lastIndexOf(intent.name))
          : latest,
    }
    send({ tool: { name: "findThreads", args: {} } })
    send({ status: "reading" })
    const result = await findThreads(args, ctx)
    chat.push(
      {
        role: "assistant",
        content: "",
        tool_calls: [{ function: { name: "findThreads", arguments: args } }],
      },
      {
        role: "tool",
        tool_name: "findThreads",
        content: JSON.stringify(result),
      },
    )
  }

  for (let step = 0; step <= MAX_STEPS; step++) {
    // on the last step, no tools: it must answer
    send({ status: "thinking" })
    const reply = await chatTools(chat, step < MAX_STEPS ? TOOLS : [], {
      model,
      signal,
    })
    if (signal.aborted) return
    if (reply.toolCalls.length === 0) {
      // Asked to delete, found entries, but never proposed it: propose the
      // search results (still only a proposal), rather than let a small model
      // drop it or claim it happened.
      if (
        !proposed &&
        ctx.lastFound.length > 0 &&
        wantsDelete(messages.at(-1)!.content)
      ) {
        send({ tool: { name: "deleteEntries", args: {} } })
        await runTool("deleteEntries", {}, ctx)
      }
      // Same for threads: the best-matching thread (or passage) from the
      // lookup above, proposed for the person to check.
      const intent = threadIntent(latest)
      if (!proposed && intent && ctx.lastThreads.length > 0) {
        const args =
          intent.action === "rename"
            ? { thread: 1, name: intent.name }
            : bestPassage(latest, ctx)
        if (args) {
          const name =
            intent.action === "rename" ? "renameThread" : "removeFromThread"
          send({ tool: { name, args } })
          await runTool(name, args, ctx)
        }
      }
      // with a proposal on screen, describe it exactly rather than trust the
      // model's wording
      const text = proposed ? "" : reply.content.trim()
      const garbled =
        !text ||
        // a tool call written out as text
        /^[{[]|\{\s*"\w+"\s*:/.test(text) ||
        // claims a change it never proposed
        /\b(propos|deleted|removed|added|saved|renamed)/i.test(text)
      send({
        t: garbled ? done.join(" ") || "I couldn't work that out." : text,
      })
      send({ done: true, model })
      return
    }
    chat.push({
      role: "assistant",
      content: reply.content,
      tool_calls: reply.toolCalls,
    })
    for (const call of reply.toolCalls) {
      const { name, arguments: args } = call.function
      send({ tool: { name, args } })
      send({ status: name.startsWith("find") ? "reading" : "proposing" })
      const result = await runTool(name, args, ctx)
      chat.push({
        role: "tool",
        tool_name: name,
        content: JSON.stringify(result),
      })
    }
  }
}
