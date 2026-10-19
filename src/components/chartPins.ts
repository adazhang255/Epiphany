"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import type { ChartSpec } from "@/features/insights/spec"

// Pinning charts to the Stats overview, from Custom or Ask, and keeping any
// open Stats page up to date (in this tab or another one) when pins change.

const CHANNEL = "charts:pins"

function announce() {
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage("changed")
    channel.close()
  } catch {}
}

// Pin `spec`; when `replacing` is given (a pinned chart opened for editing),
// the old one is removed once the new one is saved. Returns the new id, or
// null if it couldn't be saved.
export async function pinChart(spec: ChartSpec, replacing?: string) {
  const res = await fetch("/api/charts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  }).catch(() => null)
  const saved = res?.ok ? await res.json().catch(() => null) : null
  if (!saved?.id) return null
  if (replacing)
    await fetch(`/api/charts/${replacing}`, { method: "DELETE" }).catch(
      () => null,
    )
  announce()
  return saved.id as string
}

export async function unpinChart(id: string) {
  const res = await fetch(`/api/charts/${id}`, { method: "DELETE" }).catch(
    () => null,
  )
  announce()
  return Boolean(res?.ok)
}

// Refresh this page's data whenever charts are pinned or unpinned anywhere.
export function useRefreshOnPinChanges() {
  const router = useRouter()
  useEffect(() => {
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(CHANNEL)
      channel.onmessage = () => router.refresh()
    } catch {}
    return () => channel?.close()
  }, [router])
}
