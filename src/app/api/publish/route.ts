import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { buildSite } from "@/features/publish/buildSite"

// Build the static public site from published entries into PUBLISH_DIR.
// Nothing is uploaded; pushing the folder to GitHub is a separate, manual step.
export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // settings are optional
  }
  const text = (v: unknown) => (typeof v === "string" ? v : undefined)

  try {
    const result = await buildSite({
      title: text(body.title),
      description: text(body.description),
      author: text(body.author),
    })
    revalidatePath("/publish")
    return NextResponse.json(result)
  } catch (error) {
    console.error("[publish]", error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    )
  }
}
