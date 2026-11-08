import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { problem, setQuotesEnabled } from "@/features/quotes/quotes"

// POST { on: boolean }: add the Quotes tab under Notebook, or take it out
// (the quotes themselves are kept).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  try {
    await setQuotesEnabled(body?.on === true)
  } catch (error) {
    console.error("[quotes]", error)
    return NextResponse.json(
      { error: problem(error, "change the Notebook's tabs") },
      { status: 503 },
    )
  }
  revalidatePath("/", "layout")
  return NextResponse.json({ ok: true })
}
