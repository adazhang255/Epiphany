# Reflections

A journal that pulls the passages worth keeping out of each entry and lays them
out on a timeline, so you can watch your thinking change over time.

- **Timeline** (`/`): highlights grouped by month and day. Drag to scroll; the
  sort icon flips newest/oldest first. Click a highlight to open the entry with
  that passage marked.
- **Questions** (`/questions`, a Timeline tab): every sentence where you asked
  something (a "?") or wondered ("perhaps", "maybe", "I wonder"…), found by
  rule so none are missed. Mark one answered and link the entry that answered it.
- **Threads** (`/threads`, a Stats tab): highlights from different days that say
  similar things, shown in order ("In June you wrote… 8 weeks later…").
- **Stats** (`/stats`): totals, a day-by-day grid colored by each day's main
  category (or its overall tone), and topic drift by month.
  Its **Custom** tab (`/custom`) builds any chart from your entries, or lets the
  AI choose one from a question. Pin the ones you want to keep.
- **Ask** (`/ask`): ask your journal questions in plain words. Answers come
  only from your entries, cite them, and end with a question to reflect on.
- **On this day**: the top of the Timeline shows what you wrote a week, a
  month, and years ago today.
- **Import** (`/import`): turn a Google Doc (or .docx/.md/.txt, or pasted text)
  into entries. Split, titled and dated by your local Ollama model.
- **Publish** (`/publish`): choose entries to make public and build a static
  site for GitHub Pages. Everything else stays private.
- **Entry** (`/notes/[id]`) and **Write** (`/write`).

Stack: Next.js 16 (App Router), Prisma 7 + SQLite (`dev.db`), Tailwind 4, and a
local LLM via [Ollama](https://ollama.com) for highlights.

## Make it your own

This repository is the whole app with **no journal in it**. Your entries live
only in a database file on your computer (`dev.db`, git-ignored), so your copy
starts empty and fills with your own writing.

1. Get your own copy: on GitHub click **Use this template** (or fork it), then
   clone it.
2. Install [Node.js](https://nodejs.org) 20+ and [Ollama](https://ollama.com)
   (`brew install ollama` on a Mac). Ollama runs the AI on your computer;
   nothing is sent to an AI service.
3. Set it up and start it:

   ```bash
   npm install
   npm run setup        # settings, an empty journal, and a model check
   ollama serve         # in another terminal (skip if the Ollama app is open)
   ollama pull llama3.2 && ollama pull gemma3:4b && ollama pull nomic-embed-text
   npm run dev          # → http://127.0.0.1:3000
   ```

4. Want to look around before writing? `npm run demo:add` fills your journal
   with 28 made-up entries; `npm run demo:remove` takes exactly those out
   again, leaving anything you wrote. Add `-- --analyze` to have them read
   (highlights, categories, tone) as well; that takes a few minutes.
5. Write, or bring in what you have on the **Import** page (Google Docs,
   .docx, .md, .txt or pasted text).
6. To share some of it as your own website, see
   [Publishing to GitHub Pages](#publishing-to-github-pages): you pick the
   entries, and only those go public.

### Settings

`npm run setup` writes `.env.local`. You can change it any time:

```bash
DATABASE_URL="file:./dev.db"
OLLAMA_MODEL="llama3.2:latest"           # reads entries: highlights, categories
OLLAMA_CHART_MODEL="gemma3:4b"           # optional: picks charts on Custom, answers Ask
# OLLAMA_EMBED_MODEL="nomic-embed-text"  # default; powers Threads and search
# OLLAMA_IMPORT_MODEL="gemma3:12b"      # optional: default model on the Import page
# OLLAMA_HOST="http://127.0.0.1:11434"   # default; must be this computer (enforced)
# PUBLISH_DIR="public-site"              # default; where the public site is built
```

After changing `prisma/schema.prisma`, update the database with
`npm run db:push` (then `npm run db:generate`).

### Running it

Open http://localhost:3000. The server only listens on this computer
(`-H 127.0.0.1` in package.json), so other devices on your network can't reach
your journal. Remove that flag if you deliberately want network access.

If Ollama isn't running, entries still save. The entry page shows a
**Find highlights** button you can use once Ollama is up.

## How highlights work

1. When you save an entry, the app calls `POST /api/notes/highlights`.
2. That calls Ollama's HTTP API (`/api/chat`) with a JSON schema, so the model
   has to return `{ highlights: [{ quote, category }] }`.
3. Each quote is checked against the entry text. A quote that isn't word-for-word
   from the entry is dropped, so every stored highlight can be marked in the full note.
4. Highlights are saved in the `Quote` table. The timeline only reads from the
   database and never waits on the LLM.

Saving is instant: the entry is stored at once and highlights are found in the
background, one entry at a time, on the server. A small indicator in the header
shows progress on any page. Tone follows once the queue is empty, so the two
models never swap in and out of memory mid-batch.

Highlights have the same types as entries (Writing, Insight, Event, Emotion)
plus Question. On an entry page, select any passage to mark it yourself, or
click a highlight to change its type or remove it. Highlights you mark or
change are kept when you **Regenerate highlights**. The Highlights tab can show
just one type (all your Insights, all your Questions…).

Every entry has a **category**: why it was written, one or two of Writing,
Insight, Event or Emotion. The model picks it during analysis unless you've
already chosen one, and you can change it on the entry page. **Topics** (Work,
Health, …) and **#tags** describe what it's about. For older entries, use
**Categorize them** on Stats. It prefers `gemma3:4b` when installed (override
with `OLLAMA_TAG_MODEL`).

If the same text was saved more than once on the same date, the Timeline offers
**Remove duplicates**. It keeps the copy with the most highlights and asks
before deleting anything.

Each highlight is also embedded with `nomic-embed-text`. **Threads** links
highlights from different days whose embeddings are similar (cosine similarity
0.74 / 0.80 / 0.85 for Loose / Related / Close). **Questions** suggests later
highlights as possible answers. Older highlights can be embedded with the
"Read them now" button on either page.

On **Custom**, the AI only fills in a chart spec (what to count, how to group
and split it, filters). The numbers and the one-line summary are computed from
your entries, so the model can't make up data.

## Importing Google Docs

Everything is read by Ollama **on this computer**; the app refuses to talk to an
Ollama host that isn't `localhost`. Ways in:

- **Upload a file** (most private): in Google Docs, File → Download →
  Microsoft Word (.docx) or Markdown (.md), then upload it.
- **Google Doc link**: only works for docs shared as "Anyone with the link can
  view". The app downloads the doc from Google; no AI service is involved.
- **Paste text.**

Documents are split at headings and date lines (e.g. "June 3, 2025",
"2025-06-03", "6/3"). With none, the model finds where entries begin. The cuts
are always made in your original text, never retyped by the model. Then each
entry gets a title, and a date only if the text states one. You review, edit,
merge or skip entries before anything is saved.

Model: `llama3.2` (3B) works for short, well-structured docs. For long or messy
documents, a larger model splits and titles much better. On a 16 GB Mac,
`gemma3:12b` (about 8 GB) is the strongest that fits comfortably: run
`ollama pull gemma3:12b` and pick it on the Import page. Close heavy apps while
it runs. The app keeps only one chat model loaded at a time to avoid running out
of memory.

## Publishing to GitHub Pages

1. On **Publish**, tick the entries to make public and click **Build site**.
   Only those entries (plus their highlights, tags and threads among them) are
   written to `public-site/`. Unpublished entries are removed on the next build.
2. Check it with **Preview the site**.
3. When ready, make `public-site/` its own **public** repository (GitHub Pages
   is free only for public repos):
   ```bash
   cd public-site
   git init && git add . && git commit -m "Publish"
   git remote add origin git@github.com:<you>/<site-repo>.git
   git push -u origin main
   ```
   Then on GitHub, under that repo's Settings → Pages, choose "Deploy from a
   branch", `main`, `/ (root)`. After each later build: commit and push again.

`public-site/` is git-ignored here, and rebuilding never touches its `.git`
folder. Your app's own repository can be public: `dev.db`, its backups and
`.env.local` are git-ignored. Before making it public, check that none of them
was ever committed (`git log --all -- dev.db` prints nothing).

## Demo data

The made-up entries in `scripts/demo-entries.mjs` (none of it is real) can go
two places:

- **Into your journal, to try the app**: `npm run demo:add` (add
  `-- --analyze` to have them read too) and `npm run demo:remove`. Each demo
  entry carries a hidden `demo` tag, and removing deletes only those.
- **Into a separate database, for testing changes** without touching your
  journal:

  ```bash
  npm run demo:seed -- --analyze   # builds demo.db (needs `ollama serve`, ~5 min)
  npm run dev:demo                 # http://localhost:3001, using demo.db
  ```

  `demo.db` is git-ignored and that script refuses to touch any other file.

## Privacy

- The AI runs only in Ollama on this computer. The app refuses any non-local
  `OLLAMA_HOST`, and it has no other AI service or SDK.
- Next.js telemetry is disabled (`NEXT_TELEMETRY_DISABLED=1` in the scripts).
- Ask conversations aren't saved anywhere.
- Your journal lives in `dev.db`. It's git-ignored, so commits never include it.
  Back it up yourself; `dev.backup.db` is git-ignored too.
- Data leaves the computer only when you choose: a Google Doc link import
  downloads from Google, and a published site is whatever you push to GitHub.
  The published site loads its fonts from Google Fonts.

## Scripts

| Command               | What it does                         |
| --------------------- | ------------------------------------ |
| `npm run setup`       | First-time setup (safe to rerun)     |
| `npm run dev`         | Dev server on :3000                  |
| `npm run demo:add`    | Add the made-up demo entries         |
| `npm run demo:remove` | Remove the demo entries (only those) |
| `npm run build`       | Production build                     |
| `npm start`           | Serve the production build           |
| `npm run lint`        | ESLint                               |
| `npm run db:studio`   | Browse the database in Prisma Studio |
