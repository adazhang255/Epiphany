import { useEffect, useRef, useSyncExternalStore } from "react"

// The entry being written on this page (Write, or the notebook's blank
// page), as the header's Write button sees it: while there is one, the
// button saves it and says how that's going.
export type WriteStatus = "idle" | "saving" | "saved"
type Writer = { status: WriteStatus; save: () => void } | null

let writer: Writer = null
const listeners = new Set<() => void>()

function setWriter(next: Writer) {
  writer = next
  listeners.forEach((l) => l())
}

export function useWriter() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => writer,
    () => null,
  )
}

// For the editor: offer `save` to the header while `active`.
export function useHeaderSave(
  active: boolean,
  status: WriteStatus,
  save: () => void,
) {
  const latest = useRef(save)
  useEffect(() => {
    latest.current = save
  })
  useEffect(() => {
    if (!active) return
    setWriter({ status, save: () => latest.current() })
    return () => setWriter(null)
  }, [active, status])
}
