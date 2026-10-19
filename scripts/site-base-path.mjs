// The path GitHub Pages serves the public site under, from the site
// folder's GitHub remote: "" for <owner>.github.io, "/<repo>" for a project
// site. PUBLIC_BASE_PATH overrides it (e.g. "" for a custom domain).
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

export function siteBasePath(dir) {
  if (process.env.PUBLIC_BASE_PATH !== undefined)
    return process.env.PUBLIC_BASE_PATH.replace(/\/$/, "")
  const config = path.join(dir, ".git", "config")
  if (!existsSync(config)) return ""
  const url = readFileSync(config, "utf8").match(/url = (.+)/)?.[1] ?? ""
  const m = url.match(/github\.com[:/]([^/]+)\/([^/\s]+?)(\.git)?$/)
  if (!m) return ""
  const [, owner, repo] = m
  return repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? ""
    : `/${repo}`
}
