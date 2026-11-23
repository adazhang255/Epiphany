import { UndoToast } from "@/components/UndoToast"
import type { Metadata, Viewport } from "next"
import { Fraunces, Space_Mono, Work_Sans } from "next/font/google"
import { SiteHeader, TopTools } from "@/components/SiteHeader"
import "./globals.css"
import { SITE_AUTHOR, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site-mode"

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
        <UndoToast />
      </body>
    </html>
  )
}
