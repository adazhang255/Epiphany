// Put the built public site online: commit public-site/ (or PUBLISH_DIR)
// and push it to its own GitHub repository, as whoever that folder is set up
// to commit as. Build it first on the Publish page.
//   npm run publish:push            shows what changes on the site, asks, pushes
//   npm run publish:push -- --yes   …without asking
//   npm run publish:login   save a GitHub token for the site's account (asked
//                           for with the typing hidden; kept in the system
//                           keychain, never in this project)
// The site folder can belong to a different GitHub account than this app.
// Set it up once, inside the site folder:
//   git config user.name  <account>          # who the commits are by
//   git config user.email <email>
//   git config credential.https://github.com.username <account>   # who pushes
// (or set PUBLISH_GIT_NAME / PUBLISH_GIT_EMAIL in .env.local)
import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { createInterface } from "node:readline/promises"
import { describeItem, siteDiff } from "./site-diff.mjs"

// read a line without showing what's typed or pasted
function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process
    if (!stdin.isTTY) return resolve("")
    stdout.write(question)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding("utf8")
    let value = ""
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off("data", onData)
          stdout.write("\n")
          return resolve(value.trim())
        }
        if (ch === "\u0003") process.exit(130) // Ctrl+C
        if (ch === "\u007f") value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on("data", onData)
  })
}

// a setting from the environment or .env.local
function setting(name) {
  if (process.env[name]) return process.env[name]
  if (!existsSync(".env.local")) return undefined
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith(`${name}=`))
  return line
    ?.split("=")
    .slice(1)
    .join("=")
    .replace(/#.*$/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
}

const dir = path.resolve(setting("PUBLISH_DIR") ?? "public-site")
// Git never asks for a password here: a hidden prompt (VS Code shows it at
// the top of the window) just looks like a hang. A missing login is reported
// instead, with how to fix it.
const quiet = { ...process.env, GIT_TERMINAL_PROMPT: "0" }
delete quiet.GIT_ASKPASS
delete quiet.SSH_ASKPASS
delete quiet.VSCODE_GIT_ASKPASS_MAIN
const git = (args, opts = {}) =>
  execSync(`git ${args}`, { cwd: dir, encoding: "utf8", env: quiet, ...opts })

if (!existsSync(path.join(dir, "site.json"))) {
  console.log("No site built yet. Use Build site on the Publish page first.")
  process.exit(1)
}
if (!existsSync(path.join(dir, ".git"))) {
  console.log(`${dir} isn't a git repository yet. Once:
  cd ${path.relative(".", dir)} && git init -b main
  git remote add origin https://github.com/<account>/<repo>.git
then run this again. See "Publishing to GitHub Pages" in the README.`)
  process.exit(1)
}
const remote = git("remote get-url origin", { stdio: "pipe" }).trim()

const name = setting("PUBLISH_GIT_NAME") || git("config user.name").trim()
const email = setting("PUBLISH_GIT_EMAIL") || git("config user.email").trim()
const pusher = (() => {
  try {
    return git("config credential.https://github.com.username").trim()
  } catch {
    return null
  }
})()
console.log(`Site:      ${path.relative(".", dir)} → ${remote}`)
console.log(
  `Commit as: ${name} <${email}>${pusher ? `\nPush as:   ${pusher}` : ""}`,
)

const loginHelp = `GitHub needs a token for ${pusher ?? "the site's account"} (not its password):
  1. On github.com, signed in as ${pusher ?? "that account"}: Settings → Developer settings →
     Personal access tokens → Fine-grained → Generate new token. Repository
     access: only this site's repository. Permissions: Contents → Read and write.
  2. npm run publish:login   and paste the token (it won't show as you paste).`

// can that account push to the repository? A push rehearsal that changes
// nothing (reading alone needs no login when the repository is public)
function canPush() {
  try {
    git("rev-parse --verify HEAD", { stdio: "pipe" })
  } catch {
    return true // nothing committed yet to rehearse with: the push will tell
  }
  try {
    git("push --dry-run origin HEAD:main", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

if (process.argv.includes("--login")) {
  if (!pusher) {
    console.log(
      "Set who pushes first, inside the site folder:\n  git config credential.https://github.com.username <account>",
    )
    process.exit(1)
  }
  const token = await askHidden(`Token for ${pusher}: `)
  if (!token) process.exit(1)
  execSync("git credential approve", {
    cwd: dir,
    env: quiet,
    input: `protocol=https\nhost=github.com\nusername=${pusher}\npassword=${token}\n\n`,
  })
  if (canPush()) {
    console.log(`Saved. ${pusher} can push the site now: npm run publish:push`)
  } else {
    execSync("git credential reject", {
      cwd: dir,
      env: quiet,
      input: `protocol=https\nhost=github.com\nusername=${pusher}\n\n`,
    })
    console.log(
      "GitHub didn't accept that token for this repository (nothing was saved). Check it's for the right account and repository, with Contents: Read and write.",
    )
    process.exit(1)
  }
  process.exit(0)
}

if (!canPush()) {
  console.log(
    `\nCan't reach ${remote} as ${pusher ?? "this account"}, so nothing was pushed.\n${loginHelp}`,
  )
  process.exit(1)
}

git("add -A")
const changed = Boolean(git("status --porcelain").trim())
// commits made here that GitHub doesn't have yet (e.g. an earlier push failed)
const hasCommits = (() => {
  try {
    git("rev-parse --verify HEAD", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
})()
const unpushed = !hasCommits
  ? 0
  : (() => {
      try {
        return Number(
          git("rev-list --count origin/main..HEAD", { stdio: "pipe" }),
        )
      } catch {
        return Number(git("rev-list --count HEAD")) // never pushed
      }
    })()
if (!changed && unpushed === 0) {
  console.log("Nothing new since the last push.")
  process.exit(0)
}

// What goes public (or comes down) with this push, checked before anything
// leaves the computer.
{
  const d = siteDiff(dir)
  const section = (label, items) => {
    if (!items.length) return
    console.log(`\n${label} (${items.length}):`)
    for (const e of items.slice(0, 40)) console.log(`  ${describeItem(e)}`)
    if (items.length > 40) console.log(`  …and ${items.length - 40} more`)
  }
  console.log(
    d.pushedBefore
      ? "\nSince your last push:"
      : "\nFirst push: all of this becomes public.",
  )
  section("New on the site", d.added)
  section("Changed", d.changed)
  section("Taken off the site", d.removed)
  if (!d.added.length && !d.changed.length && !d.removed.length)
    console.log("  No entries change (only the site's own files).")
  if (!process.argv.includes("--yes")) {
    if (!process.stdin.isTTY) {
      console.log("\nRun it in a terminal to confirm, or add -- --yes.")
      process.exit(1)
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await rl.question("\nPush this to the public site? [y/N] ")
    rl.close()
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log("Not pushed. Nothing changed online.")
      process.exit(0)
    }
  }
}
if (changed) {
  const { entries } = JSON.parse(
    readFileSync(path.join(dir, "site.json"), "utf8"),
  )
  const message = `Publish ${entries} ${entries === 1 ? "entry" : "entries"}`
  execSync(
    `git -c user.name="${name}" -c user.email="${email}" commit -qm "${message}"`,
    { cwd: dir, stdio: "inherit" },
  )
} else {
  console.log(
    `Pushing ${unpushed} earlier commit${unpushed === 1 ? "" : "s"} that didn't reach GitHub.`,
  )
}
try {
  execSync("git push -u origin HEAD:main", {
    cwd: dir,
    stdio: "inherit",
    env: quiet,
  })
} catch {
  console.log(`\nThe push didn't go through, so nothing is online yet. Your commit is
kept: run this again once it's fixed.\n${loginHelp}`)
  process.exit(1)
}

// where GitHub Pages serves it
const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
if (m) {
  const [, owner, repo] = m
  const url =
    repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
      ? `https://${owner}.github.io/`
      : `https://${owner}.github.io/${repo}/`
  console.log(
    `Pushed. Once Pages is on (repo Settings → Pages → Deploy from a branch → main, / root), it's at ${url}`,
  )
}
