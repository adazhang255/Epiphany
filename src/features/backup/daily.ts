import { execFile } from "node:child_process"
import path from "node:path"

// Daily backups while the app is running: every hour, back up the journal if
// the newest copy is more than a day old (scripts/backup.mjs --if-due). The
// app runs with your own permissions, which macOS's background scheduler
// doesn't get for Documents. Turn off with BACKUP_AUTO=off.
const HOUR = 60 * 60 * 1000

export function startDailyBackups() {
  if (process.env.BACKUP_AUTO === "off") return
  const run = () =>
    execFile(
      /*turbopackIgnore: true*/ process.execPath,
      [
        path.join(
          /*turbopackIgnore: true*/ process.cwd(),
          "scripts/backup.mjs",
        ),
        "--if-due",
      ],
      { cwd: /*turbopackIgnore: true*/ process.cwd() },
      (error, stdout) => {
        if (error) console.error("[backup]", error.message)
        else if (stdout.trim()) console.log("[backup]", stdout.trim())
      },
    )
  setTimeout(run, 30_000) // once the app has settled
  setInterval(run, HOUR).unref()
}
