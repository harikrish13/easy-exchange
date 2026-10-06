import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { DomainError } from "@/domain/errors";
import { registerFromForm, authenticateCredentials } from "@/server/users";
import { prisma } from "@/server/db";
import { createUser, resetDatabase } from "./helpers";

describe("registration", () => {
  beforeEach(resetDatabase);

  it("stores a user with a bcrypt hash and optional city", async () => {
    const form = new FormData();
    form.set("email", "  Alex@Demo.Test ");
    form.set("password", "password123");
    form.set("displayName", " Alex Rivera ");
    form.set("city", " Portland ");

    const created = await registerFromForm(form);
    const user = await prisma.user.findUnique({ where: { id: created.id } });

    expect(user?.email).toBe("alex@demo.test");
    expect(user?.displayName).toBe("Alex Rivera");
    expect(user?.city).toBe("Portland");
    expect(user?.passwordHash).not.toBe("password123");
    expect(user?.passwordHash.startsWith("$2")).toBe(true);
    expect(await bcrypt.compare("password123", user?.passwordHash ?? "")).toBe(true);
    expect(created).not.toHaveProperty("passwordHash");
    expect(created).not.toHaveProperty("email");
  });

  it("rejects a short password and a duplicate email without a second user", async () => {
    const short = new FormData();
    short.set("email", "a@example.test");
    short.set("password", "short");
    short.set("displayName", "Alex");
    short.set("city", "");
    await expect(registerFromForm(short)).rejects.toThrow();
    expect(await prisma.user.count()).toBe(0);

    const first = new FormData();
    first.set("email", "A@Example.test");
    first.set("password", "password123");
    first.set("displayName", "Alex");
    first.set("city", "");
    await registerFromForm(first);

    const duplicate = new FormData();
    duplicate.set("email", "a@example.test");
    duplicate.set("password", "password123");
    duplicate.set("displayName", "Someone");
    duplicate.set("city", "Austin");
    await expect(registerFromForm(duplicate)).rejects.toBeInstanceOf(DomainError);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe("credentials", () => {
  beforeEach(resetDatabase);

  it("returns id and displayName only, and fails closed on a wrong password", async () => {
    await createUser({
      email: "alex@example.test",
      displayName: "Alex Rivera",
      password: "password123",
    });

    const session = await authenticateCredentials(" Alex@Example.test ", "password123");
    expect(session).toEqual({
      id: expect.any(String),
      displayName: "Alex Rivera",
    });
    expect(session).not.toHaveProperty("email");
    expect(session).not.toHaveProperty("passwordHash");

    expect(await authenticateCredentials("alex@example.test", "wrong-password")).toBeNull();
    expect(await authenticateCredentials("missing@example.test", "password123")).toBeNull();
  });
});

describe("auth surface", () => {
  it("pins next-auth to an exact version", async () => {
    const pkg = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    const version = pkg.dependencies["next-auth"];
    expect(version).toBe("5.0.0-beta.32");
    expect(version.startsWith("^") || version.startsWith("~")).toBe(false);
  });

  it("has no flow that edits display name or city after registration", async () => {
    const files = await walk(path.join(process.cwd(), "src"));
    for (const file of files) {
      const source = await fs.readFile(file, "utf8");
      expect(source).not.toMatch(/prisma\.user\.update/);
      expect(source).not.toMatch(/updateProfile/);
      expect(source).not.toMatch(/Edit profile/i);
    }
  });
});

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) files.push(full);
  }
  return files;
}
