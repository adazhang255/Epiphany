# Privacy: where your journal goes

The short version: **your writing stays on this computer.** The app runs here, its AI runs here, and nothing is sent anywhere unless you publish, import from Google Docs, or keep backups in a synced folder. The details are below, with links to the code behind each claim.

## Where your data is kept

| What | Where | Leaves this computer? | Code |
| --- | --- | --- | --- |
| Entries, highlights, threads, trackers | `dev.db` (SQLite) | No | [prisma/schema.prisma](prisma/schema.prisma) |
| Stars, thread categories, other settings | `dev.db`, `Setting` table | No | [schema](prisma/schema.prisma#L141), [stars.ts](src/features/notes/stars.ts), [categories.ts](src/features/threads/categories.ts) |
| Unsaved drafts, "last looked at Threads" | Your browser's local storage | No | [useDraft.ts](src/components/useDraft.ts), [threadsSeen.ts](src/components/threadsSeen.ts) |
| Writer profile, which passages are alike | `.cache/` | No | [profile.ts](src/features/profile/profile.ts), [pairCache.ts](src/features/threads/pairCache.ts) |
| Copies of deleted entries | `backups/` | No | [delete.service.ts](src/features/notes/services/delete.service.ts#L8-L10) |
| Scheduled backups | `backups/journal/`, or `BACKUP_DIR` if you set it | Only if `BACKUP_DIR` is a synced folder (iCloud, Dropbox…) | [scripts/backup.mjs](scripts/backup.mjs#L45), [daily.ts](src/features/backup/daily.ts) |
| The public site, once built | `public-site/` | Only when you push it (see below) | [build-public-site.mjs](scripts/build-public-site.mjs) |

`dev.db`, `dev.backup.db`, `backups/`, `.cache/`, `public-site/`, `.env` and `.env.local` are all git-ignored, so they're never committed or pushed to GitHub with the code. See [.gitignore](.gitignore).

## AI: all local

Everything AI-made is done by [Ollama](https://ollama.com) running on this computer:

- **Highlights and their types:** [analysis.ts](src/features/notes/services/analysis.ts), [ollama.service.ts](src/features/notes/services/ollama.service.ts).
- **Tone:** [tone-queue.ts](src/features/notes/services/tone-queue.ts).
- **Temporary titles:** [title-queue.ts](src/features/notes/services/title-queue.ts).
- **Embeddings:** how similar passages are, used for threads, search by meaning and Ask. See [embeddings.service.ts](src/features/notes/services/embeddings.service.ts).
- **Thread names:** [threads/titles.ts](src/features/threads/titles.ts).
- **Ask your journal:** [api/ask/route.ts](src/app/api/ask/route.ts).
- **Chart suggestions:** [askChart.ts](src/features/insights/askChart.ts), [trackers.ts](src/features/trackers/trackers.ts).
- **Cleaning up imports:** [import/ingest.ts](src/features/import/ingest.ts).
- **Your profile:** [profile.ts](src/features/profile/profile.ts).

**A built-in guard.** Before any call to Ollama, the app checks that `OLLAMA_HOST` points at this computer (`localhost`, `127.0.0.1` or `::1`). If it points anywhere else, the app refuses to send anything. See [`assertLocalOllama`](src/features/notes/services/ollama.service.ts#L44). The only call that runs without its own check just [unloads idle models](src/features/notes/services/ollama.service.ts#L173). It runs after the check has passed and sends model names, never your text.

Some features don't use AI at all:

- **The "Untitled" filters:** [TimelineView.tsx](src/components/TimelineView.tsx), [ThreadsView.tsx](src/components/ThreadsView.tsx).
- **How fast a thread grew:** [grew.ts](src/features/threads/grew.ts).
- **Search by words:** [words.ts](src/features/search/words.ts).

## Who can reach the app

- **Only this computer.** The server listens on `127.0.0.1`, so other devices on your network can't connect to it. See the `dev` and `start` scripts in [package.json](package.json).
- **Only the app itself can change things.** Every request passes through a guard, [src/proxy.ts](src/proxy.ts):
  - **The address must be this computer.** Requests not addressed to `localhost` or `127.0.0.1` are refused ([proxy.ts#L31-L35](src/proxy.ts#L31-L35)). This stops "DNS rebinding", where a website points its own name at your computer to read your entries.
  - **Changes must come from the app's own pages.** Anything that adds, changes or deletes must come from those pages, or from a script outside a browser (like `npm run demo:seed`); see [proxy.ts#L37-L57](src/proxy.ts#L37-L57). This stops other sites you have open from quietly sending changes to your journal.
  - **No frames.** The app can't be shown inside another site's frame, so it can't be disguised to trick you into clicking ([proxy.ts#L61-L62](src/proxy.ts#L61-L62)).
  - **No referrer.** Links out of the app don't tell other sites which page you came from ([proxy.ts#L63](src/proxy.ts#L63)).

## When data does leave, because you asked it to

- **Publishing** (`npm run publish:build`, then `npm run publish:push`). The code is in [scripts/build-public-site.mjs](scripts/build-public-site.mjs) and [scripts/publish-push.mjs](scripts/publish-push.mjs).
  - **Built from a copy.** The site is built from a copy of your database.
  - **Removed from that copy:** every unpublished entry and its highlights and questions, all trackers and answers, saved quotes, and the whole settings table. That table holds stars, thread categories and other settings. See [lines 137–181](scripts/build-public-site.mjs#L137-L181).
  - **Cleared from published entries:** their embeddings, AI topics and tags, and import source.
  - **What's left:** only entries, and single highlights, that you marked as published.
  - **Left out of the site:** the app's editing routes and the request guard ([lines 83–99](scripts/build-public-site.mjs#L83-L99)).
  - **Uploading:** nothing goes online until `publish:push` sends it to GitHub Pages.
- **Google Docs import.** The app downloads the document whose link you paste, from `docs.google.com` only ([extract.ts#L77-L93](src/features/import/extract.ts#L77-L93)). Nothing of yours is sent.
- **Backups.** These go wherever `BACKUP_DIR` points. The default is inside the project ([scripts/backup.mjs](scripts/backup.mjs#L45)).

## Small things worth knowing

- **Fonts.** These are downloaded from Google once, when the app is built, and served from the app after that ([layout.tsx](src/app/layout.tsx#L3), using `next/font`). Pages never contact Google while you use them.
- **Next.js usage statistics.** `npm run dev`, `build` and `start` turn these off with `NEXT_TELEMETRY_DISABLED=1`; see [package.json](package.json). If you run `npx next …` directly, add that setting yourself.
- **Leftover settings in `.env.local`.** `JWT_SECRET`, `DIRECT_URL` and `NEXT_PUBLIC_APP_URL` aren't used anywhere in the code. They look like leftovers from a template and can be deleted.
- **Dependencies.** `npm audit` shows one remaining issue, in `effect`. It's used only by Prisma's command-line tool, not by the running app, and it goes away with a future Prisma update.

## AI coding assistants (Claude Code)

If you work on this project with a cloud AI assistant, what it reads and runs goes to that service. [CLAUDE.md](CLAUDE.md) tells it never to read `dev.db`, `dev.backup.db`, `backups/` or `public-site/`, nor to open pages showing real entries. It's told to test on `demo.db`, which holds made-up entries, unless you say yes first.
