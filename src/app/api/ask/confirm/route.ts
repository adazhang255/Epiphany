import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  cancelProposal,
  confirmPhrase,
  takeProposal,
} from "@/features/ask/proposals"
import { syncQuestions } from "@/features/questions/sync"
import { removeFromThread, renameThread } from "@/features/threads/membership"
import { enqueueAnalysis } from "@/features/notes/services/analysis-queue"
import {
  deleteWithBackup,
  loadForBackup,
} from "@/features/notes/services/delete.service"

// The ONLY way an Ask proposal changes the journal. Called by the person's
// click in the app, never by the model. Every check runs again here:
//   - same-origin request (no other site can post this)
//   - a live, single-use proposal token (10 minutes; gone after one try)
//   - the exact typed phrase, e.g. "DELETE 2", matching what's confirmed
//   - deletes: only ids from the proposal, each unchanged since it was shown
//   - deletes: a backup of every entry is written before anything is removed
//   - threads: only the one rename or removal shown (entries never change)
export async function POST(req: Request) {
  const origin = req.headers.get("origin")
  const host = req.headers.get("host")
  if (!origin || !host || new URL(origin).host !== host) {
    return Response.json({ error: "Not allowed." }, { status: 403 })
  }

  let body: {
    token?: unknown
    cancel?: unknown
    phrase?: unknown
    ids?: unknown
    entries?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 })
  }
  if (typeof body.token !== "string") {
    return Response.json({ error: "Invalid request." }, { status: 400 })
  }

  if (body.cancel === true) {
    cancelProposal(body.token)
    return Response.json({ cancelled: true })
  }

  // used up now, whatever happens next: a failed confirm needs a new proposal
  const proposal = takeProposal(body.token)
  if (!proposal) {
    return Response.json(
      {
        error:
          "This proposal has expired or was already used. Ask again for a new one.",
      },
      { status: 410 },
    )
  }

  if (proposal.kind === "thread") {
    // undoable from the Threads page, so a click confirms it (no phrase)
    const { change } = proposal
    const ok =
      change.action === "rename"
        ? await renameThread(change.thread, change.to)
        : await removeFromThread(change.item, change.thread)
    if (!ok) {
      return Response.json(
        { error: "That thread can't be changed that way. Nothing changed." },
        { status: 400 },
      )
    }
    revalidatePath("/threads")
    return Response.json({ thread: change.action })
  }

  if (proposal.kind === "delete") {
    const proposed = new Map(proposal.notes.map((n) => [n.id, n.updatedAt]))
    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map(String))]
      : []
    if (ids.length === 0 || ids.some((id) => !proposed.has(id))) {
      return Response.json(
        { error: "Those entries weren't part of this proposal." },
        { status: 400 },
      )
    }
    if (body.phrase !== confirmPhrase("delete", ids.length)) {
      return Response.json(
        {
          error: `Type ${confirmPhrase("delete", ids.length)} exactly to confirm.`,
        },
        { status: 400 },
      )
    }

    const notes = await loadForBackup(ids)
    const changed =
      notes.length !== ids.length ||
      notes.some((n) => n.updatedAt.getTime() !== proposed.get(n.id))
    if (changed) {
      return Response.json(
        {
          error:
            "Some of these entries changed or were removed since they were shown. Nothing was deleted. Ask again to see the current list.",
        },
        { status: 409 },
      )
    }

    const backup = await deleteWithBackup(notes)
    revalidatePath("/", "layout")
    return Response.json({
      deleted: ids.length,
      backup,
    })
  }

  // add: the person may have edited or unticked entries in the card
  const raw = Array.isArray(body.entries) ? body.entries : []
  const entries = raw.map((e) => {
    const entry = (e ?? {}) as Record<string, unknown>
    const date =
      typeof entry.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
        ? entry.date
        : null
    return {
      title: typeof entry.title === "string" ? entry.title.trim() : "",
      content: typeof entry.content === "string" ? entry.content.trim() : "",
      date,
    }
  })
  if (
    entries.length === 0 ||
    entries.length > proposal.entries.length ||
    entries.some((e) => !e.content || !e.date)
  ) {
    return Response.json(
      { error: "Each entry needs text and a date." },
      { status: 400 },
    )
  }
  if (body.phrase !== confirmPhrase("add", entries.length)) {
    return Response.json(
      {
        error: `Type ${confirmPhrase("add", entries.length)} exactly to confirm.`,
      },
      { status: 400 },
    )
  }

  const created = await prisma.$transaction(
    entries.map((e) => {
      const [y, m, d] = e.date!.split("-").map(Number)
      return prisma.note.create({
        data: {
          title: e.title || "",
          content: e.content,
          category: "",
          tags: "",
          date: new Date(y, m - 1, d),
        },
      })
    }),
  )
  const ids = created.map((n) => n.id)
  await syncQuestions(ids)
  enqueueAnalysis(ids)
  revalidatePath("/", "layout")
  return Response.json({
    added: created.map((n) => ({ id: n.id, title: n.title })),
  })
}
