import { randomUUID } from "node:crypto"
import type { ThreadRef } from "@/features/threads/membership"

// Changes the Ask assistant has PROPOSED. The model can only create these;
// nothing happens to the journal until the person confirms one in the app
// (POST /api/ask/confirm), which the model has no way to call.
//
// Kept in memory on purpose: a proposal dies with the server, expires after
// a few minutes, and can be used once.

export const PROPOSAL_TTL_MS = 10 * 60_000
export const MAX_PER_PROPOSAL = 20

export type NewEntry = { title: string; content: string; date: string } // date: YYYY-MM-DD

// A change to a thread: give it a name, or take one passage out of it.
// Entries themselves never change.
export type ThreadChange =
  | { action: "rename"; thread: ThreadRef; from: string; to: string }
  | {
      action: "remove"
      thread: ThreadRef
      title: string
      item: string // highlight id, or "q-" + question id
      quote: string
      date: string // YYYY-MM-DD
    }

export type Proposal =
  | {
      token: string
      kind: "delete"
      expiresAt: number
      // updatedAt pins each entry as it was shown; if it changed, confirming fails
      notes: { id: string; updatedAt: number }[]
    }
  | {
      token: string
      kind: "add"
      expiresAt: number
      entries: NewEntry[]
    }
  | {
      token: string
      kind: "thread"
      expiresAt: number
      change: ThreadChange
    }

type Store = Map<string, Proposal>
const global = globalThis as unknown as { __askProposals?: Store }
const store: Store = (global.__askProposals ??= new Map())

function sweep() {
  const now = Date.now()
  for (const [token, p] of store) if (p.expiresAt < now) store.delete(token)
}

type Draft =
  | { kind: "delete"; notes: { id: string; updatedAt: number }[] }
  | { kind: "add"; entries: NewEntry[] }
  | { kind: "thread"; change: ThreadChange }

export function createProposal(draft: Draft): Proposal {
  sweep()
  const proposal = {
    ...draft,
    token: randomUUID(),
    expiresAt: Date.now() + PROPOSAL_TTL_MS,
  } as Proposal
  store.set(proposal.token, proposal)
  return proposal
}

// Hand a proposal over exactly once. Expired or unknown tokens give null.
export function takeProposal(token: string): Proposal | null {
  sweep()
  const proposal = store.get(token) ?? null
  store.delete(token)
  return proposal
}

export function cancelProposal(token: string) {
  store.delete(token)
}

// The exact phrase the person types to confirm, e.g. "DELETE 3" or "ADD 1".
export function confirmPhrase(kind: Proposal["kind"], count: number) {
  return `${kind.toUpperCase()} ${count}`
}
