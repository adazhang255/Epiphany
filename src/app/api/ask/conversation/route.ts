import { NextResponse } from "next/server"
import {
  MAX_BYTES,
  readConversation,
  saveConversation,
} from "@/features/ask/conversation"

// The Ask conversation, kept on this computer (see conversation.ts):
//   GET          → { turns }
//   PUT / POST   { turns } → saved ([] clears it). POST is for the browser's
//                sendBeacon when the page is closed.
export async function GET() {
  return NextResponse.json(
    { turns: await readConversation() },
    { headers: { "Cache-Control": "no-store" } },
  )
}

async function save(req: Request) {
  const text = await req.text()
  if (text.length > MAX_BYTES)
    return NextResponse.json({ error: "Too long to keep" }, { status: 413 })
  let turns: unknown
  try {
    turns = JSON.parse(text).turns
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  if (!Array.isArray(turns))
    return NextResponse.json(
      { error: "Send { turns: [...] }" },
      { status: 400 },
    )
  await saveConversation(turns)
  return NextResponse.json({ ok: true })
}

export const PUT = save
export const POST = save
