// Which build this is. The public site (`npm run publish:build`) is the same
// app, built read-only from your public entries only: everything that edits,
// asks the local AI, or needs the server is left out of it.
export const PUBLIC_SITE = process.env.NEXT_PUBLIC_SITE_MODE === "public"

// The path the public site is served under (e.g. "/thedetective" for a
// GitHub Pages project site), for the few plain links that aren't next/link.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

// The name, description and author set on the Publish page (public site);
// the app's own otherwise.
export const SITE_TITLE = process.env.NEXT_PUBLIC_SITE_TITLE || "Reflections"
export const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION ||
  "A journal that keeps the passages worth returning to, laid out across time."
export const SITE_AUTHOR = process.env.NEXT_PUBLIC_SITE_AUTHOR || ""
