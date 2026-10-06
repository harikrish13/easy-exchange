import path from "node:path";

const testDatabasePath = path
  .join(process.cwd(), "prisma", "test.db")
  .replaceAll("\\", "/");

process.env.DATABASE_URL = `file:${testDatabasePath}`;
