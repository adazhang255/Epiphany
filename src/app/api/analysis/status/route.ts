import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { analysisStatus } from "@/features/notes/services/analysis-queue"

// What the background analysis is doing, for the indicator in the header.
export async function GET() {
  const { pending, finished } = analysisStatus()
  const ids = [...pending, ...finished.map((f) => f.id)]
  const titles = new Map(
    (
      await prisma.note.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true },
      })
    ).map((n) => [n.id, n.title]),
  )
  return NextResponse.json(
    {
      pending: pending.map((id) => ({ id, title: titles.get(id) ?? "" })),
      finished: finished.map((f) => ({ ...f, title: titles.get(f.id) ?? "" })),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
