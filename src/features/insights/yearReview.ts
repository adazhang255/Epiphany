import { highlightType, SENTIMENT_LABELS } from "@/features/notes/lib/topics"
import type { ThreadView } from "@/features/threads/match"
import { titleText } from "@/features/notes/lib/titles"

// Year in review on Stats: per year, how much you wrote and when, what you
// wrote about most, your longest entry, your overall tone, and the idea you
// came back to most (the thread with the most passages that year).

export type YearReview = {
  year: number
  entries: number
  words: number
  days: number
  busiestMonth: { label: string; entries: number } | null
  longest: { id: string; title: string; words: number } | null
  topWords: string[]
  topType: { name: string; count: number } | null
  tone: string | null
  idea: { title: string; passages: number } | null
}

type ReviewNote = {
  id: string
  title: string
  content: string
  date: Date
  sentiment: number | null
  quotes: { category: string }[]
}

// everyday words that say nothing about what a year was about
export const STOP = new Set(
  `about above after again against all also always am an and any are aren't as at be because been before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each even ever every few for from further get gets getting got had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself just know let's like made make many maybe me more most much must my myself never no nor not now of off on once one only or other ought our ours ourselves out over own really same say said she she'd she'll she's should shouldn't so some something still such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've thing things think this those though through time to today too under until up upon very want was wasn't way we we'd we'll we're we've well were weren't what what's when when's where where's which while who who's whom why why's will with won't would wouldn't yet you you'd you'll you're you've your yours yourself yourselves back feel felt going little long much need next right since take these went whole year years day days week came come first last thought around another enough every maybe kind sure told asked looked started called found hours minutes later night morning evening stuff people someone something everything anything nothing doing being having making taking trying looking feeling thinking wanted needed tried used lots probably actually basically literally pretty keep kept left gave give gets felt seems seemed whatever every`.split(
    " ",
  ),
)

const countWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length

export function yearReviews(
  notes: ReviewNote[],
  threads: ThreadView[],
): YearReview[] {
  const years = [...new Set(notes.map((n) => n.date.getFullYear()))].sort(
    (a, b) => b - a,
  )
  return years.map((year) => {
    const inYear = notes.filter((n) => n.date.getFullYear() === year)
    const words = inYear.reduce((s, n) => s + countWords(n.content), 0)
    const days = new Set(inYear.map((n) => n.date.toDateString())).size

    const byMonth = new Map<number, number>()
    for (const n of inYear)
      byMonth.set(n.date.getMonth(), (byMonth.get(n.date.getMonth()) ?? 0) + 1)
    const [month, monthCount] =
      [...byMonth].sort((a, b) => b[1] - a[1])[0] ?? []

    const longest = [...inYear].sort(
      (a, b) => countWords(b.content) - countWords(a.content),
    )[0]

    const freq = new Map<string, number>()
    for (const n of inYear)
      for (const w of n.content.toLowerCase().match(/[\p{L}'’]+/gu) ?? []) {
        const word = w.replace(/’/g, "'").replace(/^'+|'+$/g, "")
        if (word.length < 4 || STOP.has(word)) continue
        freq.set(word, (freq.get(word) ?? 0) + 1)
      }
    const topWords = [...freq]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w)

    const types = new Map<string, number>()
    for (const n of inYear)
      for (const q of n.quotes) {
        const t = highlightType(q.category)
        if (t !== "Question") types.set(t, (types.get(t) ?? 0) + 1)
      }
    const [typeName, typeCount] =
      [...types].sort((a, b) => b[1] - a[1])[0] ?? []

    const tones = inYear.flatMap((n) =>
      n.sentiment === null ? [] : [n.sentiment],
    )
    const tone = tones.length
      ? SENTIMENT_LABELS[
          Math.max(
            -2,
            Math.min(
              2,
              Math.round(tones.reduce((a, b) => a + b, 0) / tones.length),
            ),
          )
        ]
      : null

    const idea = threads
      .map((t) => ({
        t,
        n: t.members.filter((m) => new Date(m.date).getFullYear() === year)
          .length,
      }))
      .filter((x) => x.n >= 2)
      .sort((a, b) => b.n - a.n)[0]

    return {
      year,
      entries: inYear.length,
      words,
      days,
      busiestMonth:
        month === undefined
          ? null
          : {
              label: new Date(year, month, 1).toLocaleDateString("en-US", {
                month: "long",
              }),
              entries: monthCount!,
            },
      longest: longest
        ? {
            id: longest.id,
            title: titleText(longest.title),
            words: countWords(longest.content),
          }
        : null,
      topWords,
      topType: typeName ? { name: typeName, count: typeCount! } : null,
      tone,
      idea: idea
        ? {
            title:
              idea.t.title ??
              `${idea.t.members[0].quote.split(/\s+/).slice(0, 6).join(" ")}…`,
            passages: idea.n,
          }
        : null,
    }
  })
}
