import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";

describe("DomainError", () => {
  it("signals a rule violation with a stable code", () => {
    const error = new DomainError(
      "ILLEGAL_TRANSITION",
      "That offer transition is not allowed.",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DomainError");
    expect(error.code).toBe("ILLEGAL_TRANSITION");
    expect(error.message).toBe("That offer transition is not allowed.");
  });
});
