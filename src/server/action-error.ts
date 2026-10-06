import { ZodError } from "zod";
import { DomainError } from "@/domain/errors";
import type { FormState } from "@/lib/action-result";

export function toActionError(error: unknown): FormState {
  if (error instanceof DomainError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Check the form and try again.";
    return { ok: false, error: { code: "INVALID_INPUT", message } };
  }
  throw error;
}
