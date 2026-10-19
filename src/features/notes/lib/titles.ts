// Titles the local AI wrote for entries you left untitled. They're saved as
// the entry's title with an invisible mark at the end (U+2063), so they
// travel wherever titles go and the app can show them in grey as temporary.
// Renaming the entry replaces it with yours (no mark).

export const AUTO_TITLE_MARK = "⁣"

export const isAutoTitle = (title: string | null | undefined) =>
  Boolean(title?.endsWith(AUTO_TITLE_MARK))

// the title as text, without the mark
export const plainTitle = (title: string | null | undefined) =>
  (title ?? "").replaceAll(AUTO_TITLE_MARK, "")

export const markAutoTitle = (title: string) =>
  `${plainTitle(title).trim()}${AUTO_TITLE_MARK}`

// what an entry without a title of its own has been saved as
export const UNTITLED = ["", "Untitled thought", "A thought"]
export const isUntitled = (title: string | null | undefined) =>
  UNTITLED.includes(plainTitle(title).trim()) && !isAutoTitle(title)

// for labels, tooltips and prompts: the title, or "Untitled thought"
export const titleText = (title: string | null | undefined) =>
  plainTitle(title).trim() || "Untitled thought"
