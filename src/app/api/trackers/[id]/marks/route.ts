import { NextResponse } from "next/server"
import { setMark } from "@/features/trackers/trackers"

// PUT { day: "YYYY-MM-DD", value: legend key | null } marks a day (or
// clears it).
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const day = typeof body?.day === "string" ? body.day : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    return NextResponse.json({ error: "Invalid day" }, { status: 400 })
  const value =
    typeof body?.value === "string" && body.value ? body.value : null
  try {
    await setMark(id, day, value)
  } catch {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
