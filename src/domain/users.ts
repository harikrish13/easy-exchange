import { DomainError } from "./errors";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    throw new DomainError("INVALID_DISPLAY_NAME", "Display name is required.");
  }
  return trimmed;
}

export function normalizeCity(city: string | null | undefined): string | null {
  if (city == null) return null;
  const trimmed = city.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function assertPassword(password: string): void {
  if (password.length < 8) {
    throw new DomainError(
      "INVALID_PASSWORD",
      "Password must be at least 8 characters.",
    );
  }
}
