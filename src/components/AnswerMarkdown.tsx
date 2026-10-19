"use client"

import Link from "next/link"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { CITE, CURSOR, prepareAnswer } from "@/features/ask/markdown"
import { titleText } from "@/features/notes/lib/titles"

export type SourceRef = {
  n: number
  id: string
  title: string
  date: string
  category: string
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function components(sources: SourceRef[]): Components {
  return {
    a({ href = "", children }) {
      if (href === CURSOR)
        return <span className="ml-1 animate-pulse text-ember">▍</span>
      if (href.startsWith(CITE)) {
        const cited = href
          .slice(CITE.length)
          .split("-")
          .map((n) => sources.find((s) => s.n === Number(n)))
          .filter((s): s is SourceRef => Boolean(s))
        // a number that isn't one of the sources stays as written
        if (!cited.length) return <>[{children}]</>
        return (
          <>
            {cited.map((source) => (
              <Link
                key={source.n}
                href={`/notes/${source.id}`}
                title={`${titleText(source.title)} · ${shortDate(source.date)}`}
                className="mx-0.5 rounded bg-ember/15 px-1 font-mono text-[11px] text-ember no-underline hover:bg-ember/25"
              >
                {source.n}
              </Link>
            ))}
          </>
        )
      }
      if (href.startsWith("/"))
        return (
          <Link href={href} className="text-ember underline">
            {children}
          </Link>
        )
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-ember underline"
        >
          {children}
        </a>
      )
    },
    // never load a picture from a link the model wrote; show its words
    img: ({ alt }) => (alt ? <span>{alt}</span> : null),
    p: ({ children }) => (
      <p className="my-3 whitespace-pre-line first:mt-0 last:mb-0">
        {children}
      </p>
    ),
    h1: ({ children }) => (
      <h3 className="mb-2 mt-5 font-serif text-xl text-ink first:mt-0">
        {children}
      </h3>
    ),
    h2: ({ children }) => (
      <h3 className="mb-2 mt-5 font-serif text-lg text-ink first:mt-0">
        {children}
      </h3>
    ),
    h3: ({ children }) => (
      <h4 className="mb-1 mt-4 font-mono text-[11px] uppercase tracking-widest text-ember/80 first:mt-0">
        {children}
      </h4>
    ),
    h4: ({ children }) => (
      <h4 className="mb-1 mt-4 font-semibold text-stone-100 first:mt-0">
        {children}
      </h4>
    ),
    ul: ({ children }) => (
      <ul className="my-3 list-disc space-y-1.5 pl-6 marker:text-ember/60 first:mt-0 last:mb-0">
        {children}
      </ul>
    ),
    ol: ({ children, start }) => (
      <ol
        start={start}
        className="my-3 list-decimal space-y-1.5 pl-6 marker:font-mono marker:text-sm marker:text-ember/70 first:mt-0 last:mb-0"
      >
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="pl-1 [&>ol]:my-1.5 [&>p]:my-1 [&>ul]:my-1.5">
        {children}
      </li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-stone-50">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="text-stone-400">{children}</del>,
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-2 border-ember/40 pl-4 italic text-stone-300">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-5 border-white/10" />,
    code: ({ className, children }) => (
      <code
        className={`${className ?? ""} rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em]`}
      >
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="my-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-sm leading-snug [&>code]:bg-transparent [&>code]:p-0">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse font-sans text-sm">
          {children}
        </table>
      </div>
    ),
    th: ({ children, style }) => (
      <th
        style={style}
        className="border-b border-white/15 px-2 py-1.5 text-left font-medium text-stone-100"
      >
        {children}
      </th>
    ),
    td: ({ children, style }) => (
      <td style={style} className="border-b border-white/5 px-2 py-1.5">
        {children}
      </td>
    ),
  }
}

// An Ask answer as Markdown (GitHub-style: lists, bold, tables…), with its
// citations linked to the entries. Raw HTML in it is shown as text, never
// run. While it's still arriving, a cursor follows the last word.
export function AnswerMarkdown({
  text,
  sources,
  pending = false,
}: {
  text: string
  sources: SourceRef[]
  pending?: boolean
}) {
  const md = prepareAnswer(text) + (pending ? ` [](${CURSOR})` : "")
  return (
    <div className="font-serif text-[17px] leading-relaxed text-stone-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components(sources)}
      >
        {md}
      </ReactMarkdown>
    </div>
  )
}
