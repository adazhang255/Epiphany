// Where a floating picker goes, in page coordinates (it's drawn on a layer
// above everything, see OnTop): just under a spot in the text. Near the
// right edge of `host` it hangs to the left of the spot instead (`flip`:
// shift it left by its own width), so it stays by the cursor rather than
// being pushed back across the box.
export type PickerSpot = { top: number; left: number; flip: boolean }

const ROOM = 340 // about as wide as a picker gets

// just under the right end of `rect` (a spot on screen), kept by `host`
export function spotUnder(rect: DOMRect, host: HTMLElement, gap = 4) {
  const base = host.getBoundingClientRect()
  const x = rect.right - base.left
  const flip = x + ROOM > base.width && x > ROOM / 2
  return {
    top: rect.bottom + window.scrollY + gap,
    left:
      base.left +
      window.scrollX +
      (flip ? Math.min(base.width - 8, x + 12) : Math.max(8, x - 12)),
    flip,
  }
}

// For a spot in a text box: measured on an invisible copy of the text
// (`model`) laid out exactly like the box, inside `host`.
export function pickerSpot(
  host: HTMLElement,
  model: HTMLElement,
  text: string,
  at: number,
): PickerSpot {
  const mirror = document.createElement("div")
  mirror.className = model.className
  mirror.style.visibility = "hidden"
  mirror.textContent = text.slice(0, at)
  const marker = document.createElement("span")
  marker.textContent = "​"
  mirror.appendChild(marker)
  host.appendChild(mirror)
  const spot = marker.getBoundingClientRect()
  mirror.remove()
  return spotUnder(spot, host)
}

// the style that puts a picker at a spot
export const spotStyle = (s: PickerSpot) => ({
  top: s.top,
  left: s.left,
  transform: s.flip ? "translateX(-100%)" : undefined,
})

// The end of a selection the cursor is at: where the drag finished.
export const caretEnd = (el: HTMLTextAreaElement) =>
  el.selectionDirection === "backward" ? el.selectionStart : el.selectionEnd
