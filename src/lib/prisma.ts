import { Prisma, PrismaClient } from "@/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

// In development the client is kept across reloads, with the tables it
// knew when it was made: after a schema change (new tables, `npm run
// db:push`) a new one is made, so the running app sees them without a
// restart.
const models = Object.values(Prisma.ModelName).join(",")

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaModels: string | undefined
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
})

export const prisma =
  (globalForPrisma.prismaModels === models ? globalForPrisma.prisma : null) ??
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaModels = models
}
