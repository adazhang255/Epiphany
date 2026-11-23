import { describe, expect, it } from "vitest"
import { byLatest } from "@/features/threads/build"

const m = (id: string, day: string) => ({ id, date: new Date(day) }) as never
const t = (name: string, ...members: never[]) => ({ name, members })

describe("thread order", () => {
  it("puts the thread with the most recent entry first", () => {
    const list = [
      t("old", m("a", "2026-01-01"), m("b", "2026-02-01")),
      t("new", m("c", "2026-01-05"), m("d", "2026-03-01")),
    ]
    expect(list.sort(byLatest).map((x) => x.name)).toEqual(["new", "old"])
  })

  it("breaks ties the same way whatever order the threads come in", () => {
    const one = t("one", m("a", "2026-01-01"), m("x", "2026-03-01"))
    const two = t("two", m("b", "2026-01-02"), m("y", "2026-03-01"))
    const order1 = [one, two].sort(byLatest).map((x) => x.name)
    const order2 = [two, one].sort(byLatest).map((x) => x.name)
    expect(order1).toEqual(order2)
  })
})
