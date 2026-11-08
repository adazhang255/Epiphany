"use client"

// Cancel and Save, side by side and alike, at the foot of an entry being
// written (the header's Save looks the same).
export const SAVE_BUTTON =
  "rounded-full bg-ember px-5 text-sm font-medium text-stone-950 transition hover:bg-[#f0d08f] disabled:opacity-40 disabled:hover:bg-ember"

export function SaveCancel({
  onSave,
  onCancel,
  saving,
  canSave = true,
  label = "Save entry",
  compact = false,
  className = "",
}: {
  onSave: () => void
  // none: no Cancel
  onCancel?: () => void
  saving: boolean
  canSave?: boolean
  label?: string
  // shorter, to sit on a ruled line
  compact?: boolean
  className?: string
}) {
  const pad = compact ? "py-1" : "py-2"
  return (
    <span className={`flex shrink-0 items-center gap-2 font-sans ${className}`}>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={`rounded-full border border-white/15 px-4 ${pad} text-sm text-stone-300 transition hover:border-white/30 hover:bg-white/5 hover:text-ink disabled:opacity-40`}
        >
          Cancel
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !canSave}
        aria-keyshortcuts="Meta+S"
        title="⌘S"
        className={`${SAVE_BUTTON} ${pad}`}
      >
        {saving ? "Saving…" : label}
      </button>
    </span>
  )
}
