import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import {
  normalizeCity,
  normalizeDisplayName,
  normalizeEmail,
  assertPassword,
} from "./users";
import { publicSession } from "./session";

describe("registration fields", () => {
  it("lowercases email and keeps a required display name", () => {
    expect(normalizeEmail("  Alex@Demo.Test ")).toBe("alex@demo.test");
    expect(normalizeDisplayName("  Alex Rivera ")).toBe("Alex Rivera");
    expect(normalizeCity("  Portland ")).toBe("Portland");
    expect(normalizeCity("   ")).toBeNull();
    expect(normalizeCity(null)).toBeNull();
  });

  it("rejects a missing display name and a short password", () => {
    expect(() => normalizeDisplayName("   ")).toThrow(DomainError);
    expect(() => assertPassword("short")).toThrow(DomainError);
    try {
      assertPassword("1234567");
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_PASSWORD" });
    }
    expect(() => assertPassword("12345678")).not.toThrow();
  });
});

describe("public session", () => {
  it("includes id and displayName only", () => {
    const session = publicSession({
      id: "user_alex",
      displayName: "Alex Rivera",
      email: "alex@demo.test",
      passwordHash: "secret-hash",
    });

    expect(session).toEqual({
      id: "user_alex",
      displayName: "Alex Rivera",
    });
    expect(session).not.toHaveProperty("email");
    expect(session).not.toHaveProperty("passwordHash");
    expect(Object.keys(session).sort()).toEqual(["displayName", "id"]);
  });
});
