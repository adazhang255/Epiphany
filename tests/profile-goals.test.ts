import { describe, expect, it } from "vitest"
import { goalsSection } from "@/features/profile/profile"

describe("goalsSection", () => {
  it("writes each goal as one short bullet", () => {
    expect(
      goalsSection([
        {
          goal: "paint more",
          step: "Paint the bridge at night on Saturday. It will help momentum.",
        },
        { goal: "See Priya", step: "text Priya about sourdough tonight" },
      ]),
    ).toBe(
      "**Moving toward your goals**\n* **Paint more:** Paint the bridge at night on Saturday.\n* **See Priya:** Text Priya about sourdough tonight.",
    )
  })

  it("leaves out vague, empty or long ones, and keeps three at most", () => {
    const long = Array.from({ length: 25 }, (_, i) => `w${i}`).join(" ")
    const out = goalsSection([
      { goal: "Grow", step: "Reflect on what growth means." },
      { goal: "", step: "Do a thing." },
      { goal: "Run", step: long },
      { goal: "A", step: "Do a." },
      { goal: "B", step: "Do b." },
      { goal: "C", step: "Do c." },
      { goal: "D", step: "Do d." },
    ])
    expect(out.split("\n").slice(1)).toEqual([
      "* **A:** Do a.",
      "* **B:** Do b.",
      "* **C:** Do c.",
    ])
  })

  it("is empty when there are none", () => {
    expect(goalsSection([])).toBe("")
    expect(goalsSection(undefined)).toBe("")
  })
})
