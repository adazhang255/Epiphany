import path from "node:path"
import { defineConfig } from "vitest/config"

// Unit tests for the logic that doesn't need the database or the AI:
//   npm test
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/**/*.test.ts"] },
})
