import { describe, expect, it } from "vitest";

describe("integration database", () => {
  it("uses a SQLite file other than the dev database", () => {
    const url = process.env.DATABASE_URL ?? "";
    expect(url.startsWith("file:")).toBe(true);
    expect(url).toContain("test.db");
    expect(url).not.toContain("dev.db");
  });
});
