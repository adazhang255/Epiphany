import type { Metadata } from "next"
import { Fraunces, Space_Mono, Work_Sans } from "next/font/google"
import { SiteHeader } from "@/components/SiteHeader"
import { AskBubble } from "@/components/AskBubble"
import "./globals.css"

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
  title: "Reflections",
  description:
    "A journal that keeps the passages worth returning to, laid out across time.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${workSans.variable} ${spaceMono.variable} antialiased`}
    >
      <body className="min-h-screen font-sans">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
          {children}
        </main>
        <AskBubble />
        <footer className="pb-10 text-center text-sm text-stone-600">
          Just think.
        </footer>
      </body>
    </html>
  )
}
