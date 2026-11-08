import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { cleanQuote, deleteQuote, updateQuote } from "@/features/quotes/quotes"

// PATCH { text, author?, source?, note? } changes a quote; DELETE removes it
// (with a token to undo).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const data = cleanQuote(await req.json().catch(() => null))
  if (!data)
    return NextResponse.json(
      { error: "Write the quote first." },
      { status: 400 },
    )
  try {
    const quote = await updateQuote(id, data)
    revalidatePath("/quotes")
    return NextResponse.json(quote)
  } catch {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const undo = await deleteQuote(id)
    revalidatePath("/quotes")
    return NextResponse.json({ ok: true, undo })
  } catch {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }
}
