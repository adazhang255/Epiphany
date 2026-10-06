@AGENTS.md
## Privacy: my journal entries

This app holds my private journal. Never read, print, query, screenshot or run a model on my real entries unless I've said yes first.

- These hold my entries. Don't open or query them: `dev.db`, `dev.backup.db`, `backups/`, `public-site/`.
- Don't call the API or open pages on a server running against `dev.db` in a way that returns entry text: `/api/notebook`, `/api/ask`, entry pages, screenshots of pages with entries.
- For testing, use the demo database: start the server with `DATABASE_URL=file:./demo.db` (or `npm run dev:demo`). `npm run demo:seed` rebuilds it from made-up entries. Before trusting a test server, check it's on demo data, not mine.
- Throwaway entries you create for a test are fine. Delete them afterwards.
- Reading the code is always fine (`src/`, `prisma/schema.prisma`, scripts). So are schema-only commands that don't read rows. Changing the schema of `dev.db` still needs a heads-up first.
- If a task really needs my real entries, say exactly what you'll read and why, and wait for my yes.
