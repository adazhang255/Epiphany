import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"

// Mark a found question as not really a question (or undo that):
// { notQuestion: boolean }. It's hidden from the Questions list, Threads and
// "Find answers", and stays hidden when entries are re-scanned. Its kind is
// kept after "not:" so restoring puts it back as it was.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (typeof body?.notQuestion !== "boolean") {
    return Response.json(
      { error: "Send notQuestion: true or false" },
      { status: 400 },
    )
  }
  const question = await prisma.question.findUnique({
    where: { id },
    select: { kind: true },
  })
  if (!question) {
    return Response.json({ error: "Question not found" }, { status: 404 })
  }
  const base = question.kind.replace(/^not:/, "")
  await prisma.question.update({
    where: { id },
    data: { kind: body.notQuestion ? `not:${base}` : base },
  })
  revalidatePath("/", "layout")
  return Response.json({ ok: true })
}
