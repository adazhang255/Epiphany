import type { Thread } from "@/features/notes/lib/threads"

// Shared by the server (build.ts) and the Threads page in the browser.

// Cosine-similarity cut-offs, calibrated on nomic-embed-text: unrelated
// passages land around 0.6-0.75, restatements of one idea around 0.75-0.9.
export const MATCH = {
  close: { label: "Close", threshold: 0.85 },
  related: { label: "Related", threshold: 0.8 },
  loose: { label: "Loose", threshold: 0.74 },
} as const
export type MatchLevel = keyof typeof MATCH

export type ThreadView = Thread & {
  kind: "auto" | "pinned" | "qa"
  // its title if known: the name you gave it, a question's, or one the
  // model already wrote
  title: string | null
  named: boolean // you named it
  questionId?: string // for "qa"
}
