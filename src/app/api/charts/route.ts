import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { parseSpec } from "@/features/insights/spec"
import { createSavedChart } from "@/features/notes/services/notes.service"

// Pin a chart to the Custom page.
export async function POST(req: Request) {
  let spec
  try {
    spec = parseSpec(await req.json())
  } catch {
    return NextResponse.json({ error: "Invalid chart" }, { status: 400 })
  }
  const chart = await createSavedChart(spec.title, JSON.stringify(spec))
  revalidatePath("/custom")
  return NextResponse.json(chart)
}
