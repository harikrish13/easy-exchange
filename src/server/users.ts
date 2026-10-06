import { Prisma } from "../../generated/prisma/client";
import bcrypt from "bcrypt";
import { DomainError } from "@/domain/errors";
import { publicSession } from "@/domain/session";
import {
  assertPassword,
  normalizeCity,
  normalizeDisplayName,
  normalizeEmail,
} from "@/domain/users";
import { signUpSchema, type SignUpInput } from "@/lib/auth-schema";
import { formString } from "@/lib/form-string";
import { prisma } from "./db";

export async function registerUser(input: SignUpInput): Promise<{ id: string }> {
  const email = normalizeEmail(input.email);
  const displayName = normalizeDisplayName(input.displayName);
  assertPassword(input.password);
  const city = normalizeCity(input.city);
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName, city },
      select: { id: true },
    });
    return user;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DomainError(
        "DUPLICATE_EMAIL",
        "An account with that email already exists.",
      );
    }
    throw error;
  }
}

export async function registerFromForm(formData: FormData): Promise<{ id: string }> {
  const parsed = signUpSchema.parse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    displayName: formString(formData, "displayName"),
    city: formString(formData, "city"),
  });
  return registerUser(parsed);
}

export async function authenticateCredentials(
  email: unknown,
  password: unknown,
): Promise<{ id: string; displayName: string } | null> {
  if (typeof email !== "string" || typeof password !== "string") return null;

  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
  if (!user) return null;

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) return null;

  return publicSession({
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    passwordHash: user.passwordHash,
  });
}
