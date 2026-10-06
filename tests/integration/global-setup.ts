import { execSync } from "node:child_process";

export default function setup() {
  process.env.DATABASE_URL = "file:./prisma/test.db";
  process.env.AUTH_SECRET ??= "test-auth-secret-for-vitest-only-32ch";
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
  });
}
