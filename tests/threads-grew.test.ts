import { describe, expect, it } from "vitest"
import { addedAt, grownThreads } from "@/features/threads/grew"

const d = (s: string) => new Date(s)

describe("addedAt", () => {
  it("is when it was found, for fresh writing", () => {
    expect(addedAt(d("2026-05-02"), d("2026-05-01"))).toEqual(d("2026-05-02"))
  })
  it("is when the entry was written, for highlights found again later", () => {
    expect(addedAt(d("2026-05-20"), d("2025-01-01"))).toEqual(d("2025-01-01"))
  })
})

describe("grownThreads", () => {
  const since = d("2026-05-10").getTime()
  const m = (id: string, at: string) => ({ id, addedAt: d(at) })
  it("finds threads seen before with passages added since", () => {
    const grown = grownThreads(
      [
        { id: "a", members: [m("1", "2026-05-01"), m("2", "2026-05-12")] },
        // nothing new
        { id: "b", members: [m("3", "2026-05-01"), m("4", "2026-05-02")] },
        // all new: not seen before, so it didn't grow
        { id: "c", members: [m("5", "2026-05-11"), m("6", "2026-05-12")] },
      ],
      since,
    )
    expect([...grown]).toEqual([["a", ["2"]]])
  })
  it("reads dates sent as text", () => {
    const grown = grownThreads(
      [
        {
          id: "a",
          members: [
            { id: "1", addedAt: "2026-05-01T00:00:00.000Z" },
            { id: "2", addedAt: "2026-05-12T00:00:00.000Z" },
          ],
        },
      ],
      since,
    )
    expect(grown.get("a")).toEqual(["2"])
  })
})
