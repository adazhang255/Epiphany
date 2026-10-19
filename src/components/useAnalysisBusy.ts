"use client"

import { PUBLIC_SITE } from "@/lib/site-mode"
import { useSyncExternalStore } from "react"
import { ANALYSIS_EVENT } from "@/components/AnalysisIndicator"

// Whether highlights are being found right now (the background queue, or an
// entry's "Find highlights"), shared by every button that starts analysis so
// they're greyed out meanwhile. One poll for the whole page, only while busy.

let busy = false
let started = false
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

async function check() {
  if (timer) clearTimeout(timer)
  const res = await fetch("/api/analysis/status", { cache: "no-store" }).catch(
    () => null,
  )
  const data = res?.ok ? await res.json().catch(() => null) : null
  const next = Boolean(data?.pending?.length)
  if (next !== busy) {
    busy = next
    for (const l of listeners) l()
  }
  if (busy) timer = setTimeout(check, 2000)
}

// tell the page that analysis was just started (it shows busy at once)
export function announceAnalysis() {
  busy = true
  for (const l of listeners) l()
  window.dispatchEvent(new Event(ANALYSIS_EVENT))
  setTimeout(check, 300)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // the public site never analyzes anything
  if (!started && !PUBLIC_SITE) {
    started = true
    void check()
    window.addEventListener(ANALYSIS_EVENT, () => setTimeout(check, 300))
  }
  return () => listeners.delete(listener)
}

export function useAnalysisBusy() {
  return useSyncExternalStore(
    subscribe,
    () => busy,
    () => false,
  )
}
