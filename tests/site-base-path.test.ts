import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { siteBasePath } from "../scripts/site-base-path.mjs"

// a site folder whose git remote is `url`
function siteWithRemote(url: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "site-"))
  mkdirSync(path.join(dir, ".git"))
  writeFileSync(
    path.join(dir, ".git", "config"),
    `[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`,
  )
  return dir
}

describe("siteBasePath", () => {
  afterEach(() => {
    delete process.env.PUBLIC_BASE_PATH
  })

  it("is /<repo> for a project site", () => {
    expect(
      siteBasePath(siteWithRemote("https://github.com/ada/journal.git")),
    ).toBe("/journal")
    expect(siteBasePath(siteWithRemote("git@github.com:ada/journal"))).toBe(
      "/journal",
    )
  })

  it("is empty for a user site (<owner>.github.io), in any case", () => {
    expect(
      siteBasePath(siteWithRemote("https://github.com/Ada/ada.github.io.git")),
    ).toBe("")
  })

  it("is empty without a git folder or a GitHub remote", () => {
    expect(siteBasePath(mkdtempSync(path.join(tmpdir(), "site-")))).toBe("")
    expect(siteBasePath(siteWithRemote("https://gitlab.com/ada/journal"))).toBe(
      "",
    )
  })

  it("follows PUBLIC_BASE_PATH, without a trailing slash", () => {
    process.env.PUBLIC_BASE_PATH = "/custom/"
    expect(siteBasePath(siteWithRemote("https://github.com/ada/journal"))).toBe(
      "/custom",
    )
    process.env.PUBLIC_BASE_PATH = ""
    expect(siteBasePath(siteWithRemote("https://github.com/ada/journal"))).toBe(
      "",
    )
  })
})
