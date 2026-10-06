import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // DATABASE_URL lets the demo database (demo.db) be set up the same way
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});
