import { isAutoTitle, plainTitle } from "@/features/notes/lib/titles"

// An entry's title as shown anywhere in the app. One written by the local
// AI (the entry was left untitled) is grey: temporary until you name it.
export function EntryTitle({
  title,
  fallback = "Untitled thought",
}: {
  title: string | null | undefined
  fallback?: string
}) {
  if (isAutoTitle(title))
    return (
      <span
        className="text-stone-500"
        title="A temporary title written by your local AI. Rename the entry to make it yours."
      >
        {plainTitle(title)}
      </span>
    )
  return <>{plainTitle(title).trim() || fallback}</>
}
