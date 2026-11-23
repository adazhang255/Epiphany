// Scrolling to a place on the page quickly, whatever the distance: a glide
// of a third of a second for a short way, at most about half a second (the
// browser's own smooth scrolling takes longer and longer); a long way skips
// to the last couple of screens first, so the glide stays smooth. Straight there for those who ask for less
// movement. Scrolling yourself (wheel, touch, keys) stops it.

let running: (() => void) | null = null

export function quickScroll(top: number, ms?: number) {
  running?.()
  const max = document.documentElement.scrollHeight - window.innerHeight
  const to = Math.max(0, Math.min(max, top))
  if (
    Math.abs(to - window.scrollY) < 2 ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    window.scrollTo({ top: to, behavior: "instant" })
    return
  }
  // A long way: most of it at once, then the last stretch glides in (no
  // frame can cover thousands of pixels smoothly)
  const reach = window.innerHeight * GLIDE_SCREENS
  let from = window.scrollY
  if (Math.abs(to - from) > reach) {
    from = to - Math.sign(to - from) * reach
    window.scrollTo({ top: from, behavior: "instant" })
  }
  // a third of a second, a little more the further it glides
  const screens = Math.abs(to - from) / window.innerHeight
  const duration = ms ?? 320 + screens * 80
  const start = performance.now()
  let frame = 0
  const stop = () => {
    cancelAnimationFrame(frame)
    for (const e of STOPPERS) window.removeEventListener(e, stop)
    running = null
  }
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    // ease in and out, gently (no sharp speed in the middle)
    const eased = (1 - Math.cos(Math.PI * t)) / 2
    window.scrollTo({ top: from + (to - from) * eased, behavior: "instant" })
    if (t < 1) frame = requestAnimationFrame(step)
    else stop()
  }
  for (const e of STOPPERS) window.addEventListener(e, stop, { passive: true })
  running = stop
  frame = requestAnimationFrame(step)
}

// how far a glide goes at most, in screens
const GLIDE_SCREENS = 2.5

const STOPPERS = ["wheel", "touchstart", "keydown"] as const

// an element's top at the top of the screen (clear of the sticky header),
// or its middle in the middle
export function quickScrollTo(
  el: Element,
  block: "start" | "center" = "start",
) {
  const r = el.getBoundingClientRect()
  const pad =
    parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
  quickScroll(
    block === "center"
      ? window.scrollY + r.top + r.height / 2 - window.innerHeight / 2
      : window.scrollY + r.top - pad,
  )
}
