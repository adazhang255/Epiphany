import { redirect } from "next/navigation"

// Questions now live on the timeline, under the "? Question" filter.
export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  const { kind } = await searchParams
  redirect(kind ? `/?type=question&kind=${kind}` : "/?type=question")
}
