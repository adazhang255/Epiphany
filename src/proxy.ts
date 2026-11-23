import { NextResponse, type NextRequest } from "next/server"

// Only this computer may use the app, only the app's own pages may change
// things in it, and no other site may show it in a frame.
//
// The server already listens only on this computer (127.0.0.1), but a web
// page open in your browser could still reach it:
//   - DNS rebinding: a site whose name is made to point at 127.0.0.1 could
//     load your entries as if they were its own. So every request must be
//     addressed to localhost by name or number (the Host header).
//   - Cross-site requests: any site can make your browser send a form or a
//     POST here (it can't read the answer, but it could add, change or
//     delete). So a request that changes something must come from one of
//     the app's own pages (the Origin / Sec-Fetch-Site headers), or from
//     outside a browser altogether (scripts like npm run demo:seed, which
//     send neither).
// (The public site is static files with no server, so this isn't part of
// it: scripts/build-public-site.mjs leaves it out.)

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"])

// "localhost:3000" → "localhost", "[::1]:3000" → "[::1]"
const hostname = (host: string) =>
  host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : host.split(":")[0]

const SAFE = new Set(["GET", "HEAD", "OPTIONS"])

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? ""
  if (!LOCAL.has(hostname(host).toLowerCase()))
    return new NextResponse("Only this computer can open the journal.", {
      status: 403,
    })

  if (!SAFE.has(request.method)) {
    const site = request.headers.get("sec-fetch-site")
    if (site && site !== "same-origin" && site !== "none")
      return new NextResponse("Changes can only come from the app itself.", {
        status: 403,
      })
    const origin = request.headers.get("origin")
    if (origin && origin !== "null") {
      let from = ""
      try {
        from = new URL(origin).host
      } catch {}
      if (from !== host)
        return new NextResponse("Changes can only come from the app itself.", {
          status: 403,
        })
    } else if (origin === "null")
      return new NextResponse("Changes can only come from the app itself.", {
        status: 403,
      })
  }
  const res = NextResponse.next()
  // never shown inside another site's frame (so it can't be tricked into
  // clicks), and links out don't tell other sites where you came from
  res.headers.set("X-Frame-Options", "DENY")
  res.headers.set("Content-Security-Policy", "frame-ancestors 'none'")
  res.headers.set("Referrer-Policy", "no-referrer")
  res.headers.set("X-Content-Type-Options", "nosniff")
  return res
}

export const config = {
  // everything but the app's own static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
