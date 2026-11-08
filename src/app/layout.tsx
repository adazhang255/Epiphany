import { UndoToast } from "@/components/UndoToast"
import type { Metadata, Viewport } from "next"
import { Fraunces, Space_Mono, Work_Sans } from "next/font/google"
import { SiteHeader, TopTools } from "@/components/SiteHeader"
import { AskBubble } from "@/components/AskBubble"
import "./globals.css"
import {
  PUBLIC_SITE,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from "@/lib/site-mode"
import { quotesEnabled } from "@/features/quotes/quotes"
import { connection } from "next/server"

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal"],
  axes: ["opsz"],
})

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
})

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
}

// the browser's bar on phones takes the page's colour; zooming stays allowed
export const viewport: Viewport = {
  themeColor: "#0f0f10",
  colorScheme: "dark",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // the optional Quotes section, if you've added it (never public); read
  // on each visit, so a page built ahead doesn't keep an old answer
  let quotes = false
  if (!PUBLIC_SITE) {
    await connection()
    quotes = await quotesEnabled()
  }
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${workSans.variable} ${spaceMono.variable} antialiased`}
    >
      <body className="min-h-screen font-sans">
        <SiteHeader quotes={quotes} />
        {/* beside the side nav on wide screens */}
        <div className="lg:pl-56">
          <TopTools />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-5xl px-4 pb-24 outline-none sm:px-6"
          >
            {children}
          </main>
          <footer className="pb-10 text-center text-sm text-stone-600">
            {SITE_AUTHOR ? `Written by ${SITE_AUTHOR} · ` : ""}Just think.
          </footer>
        </div>
        <AskBubble />
        <UndoToast />
      </body>
    </html>
  )
}
