import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  addQuote,
  cleanQuote,
  listQuotes,
  problem,
} from "@/features/quotes/quotes"

// Quotes you keep:
//   GET                                   → { quotes } (null: run `npm run db:push` once)
//   POST { text, author?, source?, note? } → the new quote
export async function GET() {
  return NextResponse.json(
    { quotes: await listQuotes() },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST(req: Request) {
  const data = cleanQuote(await req.json().catch(() => null))
  if (!data)
    return NextResponse.json(
      { error: "Write the quote first." },
      { status: 400 },
    )
  try {
    const quote = await addQuote(data)
    revalidatePath("/quotes")
    return NextResponse.json(quote)
  } catch (error) {
    console.error("[quotes]", error)
    return NextResponse.json(
      { error: problem(error, "keep it") },
      { status: 503 },
    )
  }
}
