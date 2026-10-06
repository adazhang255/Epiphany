import { revalidatePath } from "next/cache"
import {
  answersStatus,
  startFindingAnswers,
} from "@/features/questions/answers"

// Find answers to your questions in later entries (in the background).
// POST starts a run; GET reports progress.
export async function POST() {
  const started = startFindingAnswers()
  return Response.json({ started, ...answersStatus() })
}

export async function GET() {
  const status = answersStatus()
  if (!status.running && status.finishedAt) revalidatePath("/")
  return Response.json(status)
}
