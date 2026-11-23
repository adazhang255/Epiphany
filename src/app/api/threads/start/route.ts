import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { cleanThreadName } from "@/features/threads/field"
import { startThread } from "@/features/threads/membership"

// Start a thread from highlights (or questions, "q-" + id): { items, name }
// (or { item, name } for one).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const items = passages(body)
  const name = cleanThreadName(body?.name)
  if (items.length === 0 || !name) {
    return Response.json(
      { error: "Name the thread, and say which highlights start it" },
      { status: 400 },
    )
  }
  const [quotes, questions] = await Promise.all([
    prisma.quote.count({
      where: { id: { in: items.filter((id) => !id.startsWith("q-")) } },
    }),
    prisma.question.count({
      where: {
        id: {
          in: items
            .filter((id) => id.startsWith("q-"))
            .map((id) => id.slice(2)),
        },
      },
    }),
  ])
  if (quotes + questions < items.length) {
    return Response.json(
      {
        error:
          items.length > 1
            ? "Some of those highlights are gone"
            : "That highlight is gone",
      },
      { status: 404 },
    )
  }
  const thread = await startThread(items, name)
  revalidatePath("/threads")
  return Response.json({ ok: true, thread })
}

// the passages asked for: `items`, or one `item`
function passages(body: { item?: unknown; items?: unknown } | null) {
  const list = Array.isArray(body?.items) ? body.items : [body?.item]
  return [
    ...new Set(
      list.filter((x): x is string => typeof x === "string" && x !== ""),
    ),
  ]
}
