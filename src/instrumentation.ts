// Runs once when the app's server starts.
export async function register() {
  // not while building (the public site included), only in the running app
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.STATIC_EXPORT ||
    process.env.NEXT_PUBLIC_SITE_MODE === "public"
  )
    return
  const { startDailyBackups } = await import("@/features/backup/daily")
  startDailyBackups()
  // temporary titles for entries left untitled, once the app has settled
  const { scheduleTitleFill } =
    await import("@/features/notes/services/title-queue")
  scheduleTitleFill(30_000)
}
