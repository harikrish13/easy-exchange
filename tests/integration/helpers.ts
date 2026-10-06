import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcrypt";
import { prisma } from "@/server/db";

export function tinyJpeg(): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

export function tinyPng(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
}

export function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("test.db") || url.includes("dev.db")) {
    throw new Error("Refusing to reset a non-test database");
  }
}

export async function resetDatabase() {
  assertTestDatabase();
  const listings = await prisma.listing.findMany({ select: { id: true } });
  for (const listing of listings) {
    await fs.rm(path.join(process.cwd(), "uploads", "listings", listing.id), {
      recursive: true,
      force: true,
    });
  }
  await prisma.rating.deleteMany();
  await prisma.tradeOfferItem.deleteMany();
  await prisma.tradeOffer.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

export async function listingDirNames(): Promise<string[]> {
  const root = path.join(process.cwd(), "uploads", "listings");
  try {
    return (await fs.readdir(root)).sort();
  } catch {
    return [];
  }
}

export async function createUser(input?: {
  email?: string;
  displayName?: string;
  city?: string | null;
  password?: string;
}) {
  const password = input?.password ?? "password123";
  return prisma.user.create({
    data: {
      email: input?.email ?? `collector-${crypto.randomUUID()}@example.test`,
      passwordHash: await bcrypt.hash(password, 10),
      displayName: input?.displayName ?? "Test Collector",
      city: input?.city === undefined ? "Portland" : input.city,
    },
  });
}

export async function createCategory(slug = "trading-cards", name = "Trading Cards") {
  return prisma.category.create({ data: { slug, name } });
}
