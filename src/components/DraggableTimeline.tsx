"use client"

import { useEffect, useRef, useState } from "react"

// Below the sticky header (and the mobile month strip) the walker can be dragged.
const SCRUB_TOP = 72
const SCRUB_BOTTOM_GAP = 24

// When the walker stops this close to a day's circle, he steps onto it and
// holds it. HOLD_Y is where the held circle sits, below the screen's middle
// (his hands, in the 32px-tall drawing centred there).
const LAND_RANGE = 24
export const HOLD_Y = 5

// Wraps the timeline so it can be grabbed and dragged (with a little momentum),
// and adds a walker who travels the spine with you, announcing the day you're
// on. Drag the walker himself to race through time, like a scrollbar thumb.
export function DraggableTimeline({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const scrub = useRef<{ startY: number; startScroll: number } | null>(null)
  // while scrubbing, the walker follows the pointer at this fixed position
  const [scrubAt, setScrubAt] = useState<{ x: number; y: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [walking, setWalking] = useState(false)
  const [facingUp, setFacingUp] = useState(false)
  const [here, setHere] = useState<string | null>(null)
  const [holding, setHolding] = useState(false)

  // Track scroll: which day sits under the walker, and whether we're moving.
  useEffect(() => {
    let lastY = window.scrollY
    let stopTimer: ReturnType<typeof setTimeout>

    // Once he stops: if a day's circle is within reach, ease it into his
    // hands (that scroll ends here again, now lined up) and hold it.
    function land() {
      if (scrub.current) return
      const hands = window.innerHeight / 2 + HOLD_Y
      let nearest: number | null = null
      for (const dot of ref.current?.querySelectorAll("[data-day-dot]") ?? []) {
        const r = dot.getBoundingClientRect()
        const d = r.top + r.height / 2 - hands
        if (nearest === null || Math.abs(d) < Math.abs(nearest)) nearest = d
      }
      if (nearest === null || Math.abs(nearest) > LAND_RANGE) return
      if (Math.abs(nearest) <= 1.5) setHolding(true)
      else window.scrollBy({ top: nearest, behavior: "smooth" })
    }

    function update() {
      const y = window.scrollY
      if (y !== lastY) {
        setFacingUp(y < lastY)
        setWalking(true)
        setHolding(false)
        clearTimeout(stopTimer)
        stopTimer = setTimeout(() => {
          setWalking(false)
          land()
        }, 160)
      }
      lastY = y

      const middle = window.innerHeight / 2
      const days =
        ref.current?.querySelectorAll<HTMLElement>("[data-day-label]") ?? []
      let current: string | null = null
      for (const day of days) {
        if (day.getBoundingClientRect().top <= middle)
          current = day.dataset.dayLabel ?? null
        else break
      }
      setHere(current)

      const el = ref.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const done = (middle - rect.top) / Math.max(1, rect.height)
        setProgress(Math.round(Math.min(1, Math.max(0, done)) * 100))
      }
    }

    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => {
      window.removeEventListener("scroll", update)
      clearTimeout(stopTimer)
    }
  }, [])

  // Mouse drag-to-scroll. Touch already scrolls natively.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startY = 0
    let lastY = 0
    let lastT = 0
    let velocity = 0
    let moved = false
    let active = false
    let glide = 0

    function onDown(e: MouseEvent) {
      if (e.button !== 0) return
      if (
        (e.target as HTMLElement).closest(
          "button, summary, input, textarea, select, [data-walker]",
        )
      )
        return
      e.preventDefault() // no text selection or native link-drag while grabbing
      cancelAnimationFrame(glide)
      active = true
      moved = false
      startY = lastY = e.clientY
      lastT = performance.now()
      velocity = 0
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp, { once: true })
    }

    function onMove(e: MouseEvent) {
      if (!active) return
      const now = performance.now()
      const dy = e.clientY - lastY
      window.scrollBy({ top: -dy, behavior: "instant" })
      velocity = -dy / Math.max(1, now - lastT)
      lastY = e.clientY
      lastT = now
      if (!moved && Math.abs(e.clientY - startY) > 5) {
        moved = true
        setDragging(true)
      }
    }

    function onUp() {
      active = false
      window.removeEventListener("mousemove", onMove)
      setDragging(false)
      if (!moved) return

      // swallow the click that ends a drag so we don't open a note by accident
      window.addEventListener(
        "click",
        (e) => {
          e.preventDefault()
          e.stopPropagation()
        },
        { capture: true, once: true },
      )

      let v = velocity * 16
      const step = () => {
        if (Math.abs(v) < 0.5) return
        window.scrollBy({ top: v, behavior: "instant" })
        v *= 0.94
        glide = requestAnimationFrame(step)
      }
      glide = requestAnimationFrame(step)
    }

    el.addEventListener("mousedown", onDown)
    return () => {
      el.removeEventListener("mousedown", onDown)
      window.removeEventListener("mousemove", onMove)
      cancelAnimationFrame(glide)
    }
  }, [])

  // The scroll positions where the timeline's first and last moments sit in
  // the middle of the window: the walker travels between these, never past.
  function timelineSpan() {
    const el = ref.current!
    const rect = el.getBoundingClientRect()
    const middle = window.innerHeight / 2
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const first = Math.max(0, window.scrollY + rect.top - middle)
    const last = Math.min(maxScroll, window.scrollY + rect.bottom - middle)
    return { first, last: Math.max(first, last) }
  }

  // Keep the dragged walker on the visible stretch of the timeline's spine.
  function clampToSpine(y: number) {
    const rect = ref.current!.getBoundingClientRect()
    const lo = Math.max(rect.top + 16, SCRUB_TOP)
    const hi = Math.min(rect.bottom - 16, window.innerHeight - SCRUB_BOTTOM_GAP)
    return Math.min(Math.max(y, lo), Math.max(lo, hi))
  }

  // Dragging the walker scrubs the timeline from its first to its last
  // moment: wherever you grab him, the top edge of the window is the newest
  // end and the bottom edge the oldest, with no jump when you grab him.
  function onScrubStart(e: React.PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    scrub.current = { startY: e.clientY, startScroll: window.scrollY }
    setScrubAt({
      x: (track.current?.getBoundingClientRect().left ?? 0) - 5,
      y: clampToSpine(e.clientY),
    })
  }

  function onScrubMove(e: React.PointerEvent) {
    if (!scrub.current) return
    const top = SCRUB_TOP
    const bottom = window.innerHeight - SCRUB_BOTTOM_GAP
    const y = Math.min(bottom, Math.max(top, e.clientY))
    const { startY } = scrub.current
    const { first, last } = timelineSpan()
    const startScroll = Math.min(
      last,
      Math.max(first, scrub.current.startScroll),
    )
    // separate scales above and below the grab point, each reaching an end
    const target =
      y < startY
        ? first +
          (startScroll - first) * ((y - top) / Math.max(1, startY - top))
        : startScroll +
          (last - startScroll) * ((y - startY) / Math.max(1, bottom - startY))
    window.scrollTo({ top: target, behavior: "instant" })
    setScrubAt((at) => (at ? { ...at, y: clampToSpine(e.clientY) } : at))
  }

  function onScrubEnd() {
    scrub.current = null
    setScrubAt(null)
  }

  // Keyboard: arrow keys step a day at a time, Home/End jump to the ends.
  function onScrubKey(e: React.KeyboardEvent) {
    const days = [
      ...(ref.current?.querySelectorAll<HTMLElement>("[data-day-label]") ?? []),
    ]
    if (days.length === 0) return
    const middle = window.innerHeight / 2
    const current = Math.max(
      0,
      days.findLastIndex((d) => d.getBoundingClientRect().top <= middle + 1),
    )
    const target = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: days.length - 1,
    }[e.key]
    if (target === undefined) return
    e.preventDefault()
    days[Math.min(days.length - 1, Math.max(0, target))].scrollIntoView({
      block: "center",
    })
  }

  const scrubbing = scrubAt !== null
  const bubble = here && (
    <span
      className={`ml-2 whitespace-nowrap rounded-full border border-ember/40 bg-[#101011]/95 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-ember shadow-lg transition-opacity duration-300 ${
        scrubbing ? "opacity-100" : "opacity-0"
      }`}
    >
      {here}
    </span>
  )

  return (
    <div
      ref={ref}
      className={`relative ${dragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
    >
      {/* full-height track; the walker sticks to the middle of the screen */}
      <div
        ref={track}
        className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[15px]"
      >
        <div className="sticky top-[50vh] -translate-y-1/2">
          <div className="relative -left-[5px] flex items-center">
            <div
              data-walker
              role="slider"
              tabIndex={0}
              aria-label="Travel through time: drag, or use the arrow keys"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-valuetext={here ?? undefined}
              title="Drag me to travel through time"
              onPointerDown={onScrubStart}
              onPointerMove={onScrubMove}
              onPointerUp={onScrubEnd}
              onPointerCancel={onScrubEnd}
              onKeyDown={onScrubKey}
              className={`pointer-events-auto -m-2 cursor-grab touch-none rounded-full p-2 outline-offset-2 transition-transform hover:scale-110 active:cursor-grabbing ${
                scrubbing ? "opacity-0" : ""
              }`}
            >
              <Walker
                walking={walking}
                flipped={facingUp}
                holding={holding && !scrubbing}
              />
            </div>
          </div>
        </div>
      </div>

      {/* while scrubbing, the walker rides along with the pointer */}
      {scrubAt && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 flex -translate-y-1/2 items-center"
          style={{ left: scrubAt.x, top: scrubAt.y }}
        >
          <div className="scale-110">
            <Walker walking={walking} flipped={facingUp} />
          </div>
          {bubble}
        </div>
      )}
      {children}
    </div>
  )
}

export function Walker({
  walking,
  flipped,
  holding = false,
}: {
  walking: boolean
  flipped: boolean
  // standing on a day, holding its circle in front of him
  holding?: boolean
}) {
  return (
    <svg
      width="26"
      height="32"
      viewBox="0 0 26 32"
      overflow="visible"
      className={`walker shrink-0 drop-shadow-[0_0_6px_rgba(232,194,122,0.35)] ${walking && !holding ? "is-walking" : ""}`}
      style={{ transform: flipped && !holding ? "scaleX(-1)" : undefined }}
    >
      <g stroke="#e8c27a" strokeWidth="2" strokeLinecap="round" fill="none">
        <circle cx="13" cy="5" r="3.5" fill="#101011" />
        <path d="M13 9 L13 19" />
        {holding ? (
          <>
            {/* elbows out, feet below, the day's circle covering the page's
                own dot exactly (x 12.5 is the spine's centre) */}
            <path d="M13 12 L7 14 L5.5 20" />
            <path d="M13 12 L18 14 L19.5 20" />
            <path d="M13 19 L8 31" />
            <path d="M13 19 L18 31" />
            <circle cx="12.5" cy={16 + HOLD_Y} r="6.5" fill="#101011" />
          </>
        ) : (
          <>
            <path className="arm arm-a" d="M13 12 L8 16" />
            <path className="arm arm-b" d="M13 12 L18 16" />
            <path className="leg leg-a" d="M13 19 L9 27" />
            <path className="leg leg-b" d="M13 19 L17 27" />
          </>
        )}
      </g>
    </svg>
  )
}
