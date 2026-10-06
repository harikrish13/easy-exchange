import { DomainError } from "./errors";

export function publicSession(input: {
  id: unknown;
  displayName: unknown;
  email?: unknown;
  passwordHash?: unknown;
}): { id: string; displayName: string } {
  if (typeof input.id !== "string" || input.id.length === 0) {
    throw new DomainError("INVALID_SESSION", "Session is missing a user id.");
  }
  if (typeof input.displayName !== "string" || input.displayName.length === 0) {
    throw new DomainError("INVALID_SESSION", "Session is missing a display name.");
  }

  return {
    id: input.id,
    displayName: input.displayName,
  };
}
