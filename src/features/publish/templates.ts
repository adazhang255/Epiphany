// Static assets for the published site: plain CSS and a little vanilla JS,
// no framework, so GitHub Pages can serve them as-is.

export const SITE_CSS = `
:root {
  color-scheme: dark;
  --ink: #f5f4ef;
  --text: #d6d3cc;
  --muted: #8a8a82;
  --faint: #57534e;
  --panel: #161617;
  --line: rgb(255 255 255 / 0.08);
  --ember: #e8c27a;
  --serif: "Fraunces", Georgia, serif;
  --sans: "Work Sans", system-ui, sans-serif;
  --mono: "Space Mono", ui-monospace, monospace;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 5rem; }
body {
  margin: 0;
  background: linear-gradient(#0e0e0f, #131314) fixed;
  color: var(--text);
  font-family: var(--sans);
  line-height: 1.5;
}
a { color: inherit; }
.wrap { max-width: 880px; margin: 0 auto; padding: 0 16px 96px; }
header.site {
  position: sticky; top: 0; z-index: 30;
  background: rgb(15 15 16 / 0.85); backdrop-filter: blur(16px);
  border-bottom: 1px solid rgb(255 255 255 / 0.05);
}
header.site .wrap { display: flex; align-items: center; gap: 16px; height: 60px; padding-bottom: 0; }
header.site .brand { font-family: var(--serif); font-size: 20px; color: var(--ink); text-decoration: none; }
header.site nav { margin-left: auto; display: flex; gap: 4px; }
header.site nav a { text-decoration: none; font-size: 14px; color: #a8a29e; padding: 6px 12px; border-radius: 999px; }
header.site nav a[aria-current] { background: rgb(255 255 255 / 0.1); color: var(--ink); }
.eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); margin: 0; }
h1 { font-family: var(--serif); font-weight: 400; color: var(--ink); font-size: clamp(34px, 6vw, 48px); line-height: 1.1; margin: 8px 0 12px; }
.lede { color: #a8a29e; margin: 0; }
.intro { padding: 48px 0 40px; }

.timeline { position: relative; }
.spine { position: absolute; left: 7px; top: 8px; bottom: 0; width: 1px; background: linear-gradient(var(--ember), #44403c, #292524); opacity: 0.8; }
.month > h2 {
  position: sticky; top: 60px; z-index: 10; display: flex; align-items: baseline; gap: 12px;
  margin: 0 0 24px; padding: 12px 0 16px 32px;
  background: linear-gradient(#101011, rgb(16 16 17 / 0.95), transparent);
  font-family: var(--serif); font-weight: 400; font-size: 30px; color: var(--ink);
}
.month > h2 small { font-family: var(--mono); font-size: 13px; color: var(--muted); }
.day { position: relative; padding-left: 40px; padding-bottom: 32px; }
.day::before {
  content: ""; position: absolute; left: 0; top: 3px; width: 15px; height: 15px;
  border-radius: 999px; border: 2px solid var(--ember); background: #101011; box-sizing: border-box;
}
.day time { font-family: var(--mono); font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; color: #a8a29e; }
.entry { margin-top: 12px; }
.entry + .entry { margin-top: 28px; }
.entry-title { font-family: var(--serif); font-size: 19px; color: #e7e5e4; text-decoration: none; }
.entry-title:hover { color: var(--ink); text-decoration: underline; }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: 6px; }
.purpose { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; color: #0c0a09; font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; list-style: none; padding: 0; margin: 12px 0 0; }
.card { display: flex; flex-direction: column; height: 100%; padding: 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--panel); text-decoration: none; transition: border-color .2s, transform .2s; }
.card:hover { border-color: rgb(232 194 122 / 0.4); transform: translateY(-2px); }
.card .kind { font-family: var(--mono); font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.card q { flex: 1; display: block; margin: 8px 0 12px; font-family: var(--serif); font-size: 16px; line-height: 1.35; color: #e7e5e4; quotes: "“" "”"; }
details.more { margin-top: 12px; }
details.more summary { display: inline-flex; gap: 8px; cursor: pointer; list-style: none; font-family: var(--mono); font-size: 12px; color: #a8a29e; padding: 4px 12px; border: 1px solid var(--line); border-radius: 999px; }
details.more summary::-webkit-details-marker { display: none; }
details.more[open] .count { display: none; }
details.more:not([open]) .less { display: none; }

.walker-track { position: absolute; left: 0; top: 0; bottom: 0; width: 15px; z-index: 20; pointer-events: none; }
.walker { position: sticky; top: 50vh; transform: translateY(-50%); display: flex; align-items: center; margin-left: -5px; }
.walker svg { flex-shrink: 0; pointer-events: auto; cursor: grab; touch-action: none; filter: drop-shadow(0 0 6px rgb(232 194 122 / 0.35)); }
.walker .bubble { margin-left: 8px; white-space: nowrap; font-family: var(--mono); font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ember); background: rgb(16 16 17 / 0.95); border: 1px solid rgb(232 194 122 / 0.4); border-radius: 999px; padding: 4px 10px; opacity: 0; transition: opacity .3s; }
.walker.scrubbing .bubble { opacity: 1; }
.walker .leg, .walker .arm { transform-box: view-box; }
.walker .leg { transform-origin: 13px 19px; }
.walker .arm { transform-origin: 13px 12px; }
.walker.moving .leg-a, .walker.moving .arm-b { animation: stride .42s ease-in-out infinite alternate; }
.walker.moving .leg-b, .walker.moving .arm-a { animation: stride .42s ease-in-out infinite alternate-reverse; }
@keyframes stride { from { transform: rotate(-22deg); } to { transform: rotate(22deg); } }
@media (prefers-reduced-motion: reduce) { .walker .leg, .walker .arm { animation: none !important; } html { scroll-behavior: auto; } }

article.full { padding-top: 40px; }
.back { font-family: var(--mono); font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--ink); }
.body { margin-top: 32px; white-space: pre-wrap; font-family: var(--serif); font-size: 19px; line-height: 1.8; color: #d6d3d1; }
mark { background: rgb(232 194 122 / 0.12); color: inherit; border-radius: 3px; padding: 0 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
mark:target { background: rgb(232 194 122 / 0.38); box-shadow: 0 0 0 3px rgb(232 194 122 / 0.18); }
.neighbors { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 48px; }
.neighbors a { display: block; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; text-decoration: none; }
.neighbors a span { display: block; font-family: var(--mono); font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.neighbors .next { text-align: right; grid-column: 2; }

.thread { padding: 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); margin-bottom: 24px; }
.thread ol { list-style: none; margin: 0; padding: 0 0 0 24px; border-left: 1px solid rgb(232 194 122 / 0.3); }
.thread li { position: relative; padding-bottom: 20px; }
.thread li::before { content: ""; position: absolute; left: -30px; top: 6px; width: 10px; height: 10px; border-radius: 999px; border: 2px solid var(--ember); background: var(--panel); box-sizing: border-box; }
.thread .when { font-family: var(--mono); font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.thread a.q { display: block; margin-top: 6px; font-family: var(--serif); font-size: 18px; line-height: 1.35; color: #e7e5e4; text-decoration: none; }
.thread a.q:hover { color: var(--ink); }
.thread .from { font-size: 12px; color: var(--muted); }
footer.site { text-align: center; color: var(--faint); font-size: 13px; padding: 40px 16px; }
@media (max-width: 600px) { .neighbors { grid-template-columns: 1fr; } .neighbors .next { grid-column: 1; } }
`

// The walker from the app: follows the timeline, shows the day you're on, and
// can be dragged to scrub through time.
export const WALKER_JS = `
(() => {
  const timeline = document.querySelector(".timeline")
  const walker = document.querySelector(".walker")
  if (!timeline || !walker) return
  const svg = walker.querySelector("svg")
  const bubble = walker.querySelector(".bubble")
  const days = [...document.querySelectorAll("[data-day-label]")]
  let lastY = scrollY, stop
  function update() {
    const y = scrollY
    if (y !== lastY) {
      walker.classList.add("moving")
      svg.style.transform = y < lastY ? "scaleX(-1)" : ""
      clearTimeout(stop)
      stop = setTimeout(() => walker.classList.remove("moving"), 200)
    }
    lastY = y
    const middle = innerHeight / 2
    let label = ""
    for (const d of days) { if (d.getBoundingClientRect().top <= middle) label = d.dataset.dayLabel; else break }
    bubble.textContent = label
  }
  addEventListener("scroll", update, { passive: true })
  update()

  let drag = null
  svg.addEventListener("pointerdown", (e) => {
    e.preventDefault()
    svg.setPointerCapture(e.pointerId)
    drag = { y: e.clientY, scroll: scrollY }
    walker.classList.add("scrubbing")
    document.documentElement.style.scrollBehavior = "auto"
  })
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return
    // scrub between the timeline's first and last moments, never past them
    const top = 70, bottom = innerHeight - 24
    const y = Math.min(bottom, Math.max(top, e.clientY))
    const r = timeline.getBoundingClientRect(), mid = innerHeight / 2
    const max = document.documentElement.scrollHeight - innerHeight
    const first = Math.max(0, scrollY + r.top - mid)
    const last = Math.max(first, Math.min(max, scrollY + r.bottom - mid))
    const from = Math.min(last, Math.max(first, drag.scroll))
    scrollTo(0, y < drag.y
      ? first + (from - first) * ((y - top) / Math.max(1, drag.y - top))
      : from + (last - from) * ((y - drag.y) / Math.max(1, bottom - drag.y)))
  })
  const end = () => { drag = null; walker.classList.remove("scrubbing"); document.documentElement.style.scrollBehavior = "" }
  svg.addEventListener("pointerup", end)
  svg.addEventListener("pointercancel", end)
})()
`

export const WALKER_SVG = `<svg width="26" height="32" viewBox="0 0 26 32" role="img" aria-label="Drag to travel through time"><g stroke="#e8c27a" stroke-width="2" stroke-linecap="round" fill="none"><circle cx="13" cy="5" r="3.5" fill="#101011"/><path d="M13 9 L13 19"/><path class="arm arm-a" d="M13 12 L8 16"/><path class="arm arm-b" d="M13 12 L18 16"/><path class="leg leg-a" d="M13 19 L9 27"/><path class="leg leg-b" d="M13 19 L17 27"/></g></svg>`
