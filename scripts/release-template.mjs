// Update the public template repository to match this app's latest commit:
// only committed files (never dev.db, backups, .env*, public-site), with no
// history. Commit here first; uncommitted changes aren't included.
//   npm run release:template              copy, commit and push
//   npm run release:template -- --dry-run copy and commit, don't push
// The template lives in ../reflections (or TEMPLATE_DIR). The first run
// creates it; then make a public GitHub repo for it and add it as `origin`.
import { execSync } from "node:child_process"
import { existsSync, mkdirSync, realpathSync } from "node:fs"
import path from "node:path"

const target = path.resolve(process.env.TEMPLATE_DIR ?? "../reflections")
const push = !process.argv.includes("--dry-run")
const run = (cmd, cwd = ".") =>
  execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })

// never anything private, even if it was committed by mistake
const PRIVATE =
  /(^|\/)([^/]*\.db|[^/]*\.db-(journal|wal|shm)|\.env[^/]*|mcp\.json)$|^(backups|public-site|\.cache|\.public-build)\//
// what's released is the last commit, so check that (not the staging area)
const tracked = run("git ls-tree -r --name-only HEAD")
  .split("\n")
  .filter(Boolean)
const leaks = tracked.filter((f) => PRIVATE.test(f))
if (leaks.length) {
  console.error(
    `Stopped: these private files are committed here:\n  ${leaks.join("\n  ")}\nRemove them (git rm --cached) and commit first.`,
  )
  process.exit(1)
}
if (run("git status --porcelain").trim())
  console.log(
    "Note: you have uncommitted changes; only the last commit is released.",
  )

if (!existsSync(target)) {
  mkdirSync(target, { recursive: true })
  run("git init -b main", target)
  console.log(`Created the template folder at ${target}`)
}
if (path.resolve(target) === path.resolve(".")) {
  console.error("Stopped: TEMPLATE_DIR is this repository.")
  process.exit(1)
}
// it must be a repository of its own: otherwise the "git rm" below would
// empty that folder inside whatever repository contains it
let top = ""
try {
  top = run("git rev-parse --show-toplevel", target).trim()
} catch {}
if (!top || realpathSync(top) !== realpathSync(target)) {
  console.error(
    `Stopped: ${target} isn't a git repository of its own. Move it aside (or set TEMPLATE_DIR) and run again to create it.`,
  )
  process.exit(1)
}

// replace everything with the latest commit (so deleted files go too)
run("git rm -rq --ignore-unmatch .", target)
execSync(`git archive HEAD | tar -x -C "${target}"`, { stdio: "inherit" })
run("git add -A", target)
const head = run("git rev-parse --short HEAD").trim()
const subject = run("git log -1 --format=%s").trim()
if (!run("git status --porcelain", target).trim()) {
  console.log("The template is already up to date.")
  process.exit(0)
}
run(`git commit -qm "Update to ${head}: ${subject.replace(/"/g, "'")}"`, target)
console.log(`Committed the template at ${head} (${subject}).`)

if (!push) {
  console.log("Dry run: not pushed.")
} else if (!run("git remote", target).trim()) {
  console.log(`Not pushed yet: the template has no GitHub repo. Once:
  cd ${target}
  gh repo create reflections --public --source=. --push
  gh repo edit --template`)
} else {
  execSync("git push -u origin main", { cwd: target, stdio: "inherit" })
  console.log("Pushed. The public template is up to date.")
}
