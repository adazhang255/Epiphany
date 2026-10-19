// Run `npm run backup` every night at 3:00 with macOS's own scheduler
// (launchd). If the Mac is asleep then, it runs when it wakes.
//   npm run backup:schedule     turn it on (again, after moving the project)
//   npm run backup:unschedule   turn it off
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

const off = process.argv.includes("--off")
const label = "com.reflections.journal-backup"
const agents = path.join(process.env.HOME ?? "", "Library/LaunchAgents")
const plist = path.join(agents, `${label}.plist`)
const domain = `gui/${process.getuid()}`
const root = process.cwd()

if (process.platform !== "darwin") {
  console.log(
    "Scheduling is for macOS. Elsewhere, run `npm run backup` from cron or Task Scheduler.",
  )
  process.exit(1)
}

// whatever was scheduled before goes first
try {
  execFileSync("launchctl", ["bootout", `${domain}/${label}`], {
    stdio: "ignore",
  })
} catch {}
if (off) {
  rmSync(plist, { force: true })
  console.log("Nightly backups are off. (Existing backups are kept.)")
  process.exit(0)
}

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
mkdirSync(agents, { recursive: true })
mkdirSync(path.join(root, "backups"), { recursive: true })
writeFileSync(
  plist,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${esc(process.execPath)}</string>
    <string>${esc(path.join(root, "scripts/backup.mjs"))}</string>
  </array>
  <key>WorkingDirectory</key><string>${esc(root)}</string>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>${esc(path.join(root, "backups/schedule.log"))}</string>
  <key>StandardErrorPath</key><string>${esc(path.join(root, "backups/schedule.log"))}</string>
</dict>
</plist>
`,
)
execFileSync("launchctl", ["bootstrap", domain, plist])
console.log(
  `Nightly backups are on: every day at 3:00 (or on waking), from ${root}.
Turn them off with: npm run backup:unschedule`,
)
if (!existsSync(plist)) process.exit(1)
