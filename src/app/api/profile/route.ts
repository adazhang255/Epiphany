import { profileJob, startProfileJob } from "@/features/profile/profile"

// The writer profile on Stats, written in the background by the local model.
//   POST  start writing it (if it isn't already being written)
//   GET   how it's going: { running, step, of, startedAt, error }
export async function POST() {
  return Response.json(startProfileJob())
}

export async function GET() {
  return Response.json(profileJob(), {
    headers: { "Cache-Control": "no-store" },
  })
}
