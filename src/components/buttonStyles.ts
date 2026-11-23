// The app's small buttons, one look everywhere: the same border, text
// colour and hover. A button that's on (a chosen filter, an open menu)
// uses the _ON version. Colour is kept for what it means (a highlight
// type's dot, red only once you're about to remove something).

// an action beside something (Add a highlight, Merge…, Remove thread)
export const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-stone-300 transition hover:border-white/25 hover:text-ink disabled:opacity-40"
export const PILL_ON =
  "inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-ink"

// a filter chip over a list (All, Starred, a type…)
export const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-sm text-stone-300 transition hover:border-white/25 hover:text-ink"
export const CHIP_ON =
  "inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm text-ink"
