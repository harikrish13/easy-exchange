import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";

export function uploadsRoot(): string {
  return path.resolve(process.cwd(), "uploads");
}

type PhotoIo = {
  writeFile: (filePath: string, bytes: Uint8Array) => Promise<void>;
  remove: (filePath: string) => Promise<void>;
};

const defaultIo: PhotoIo = {
  writeFile: (filePath, bytes) => fs.writeFile(filePath, bytes),
  remove: (filePath) => fs.rm(filePath, { force: true }),
};

export async function writePhotoFiles(
  files: { absolutePath: string; bytes: Uint8Array }[],
  io: PhotoIo = defaultIo,
): Promise<void> {
  const written: string[] = [];
  try {
    for (const file of files) {
      await io.writeFile(file.absolutePath, file.bytes);
      written.push(file.absolutePath);
    }
  } catch (error) {
    for (const writtenPath of written) {
      await io.remove(writtenPath);
    }
    throw error;
  }
}

export async function removeListingFiles(listingId: string): Promise<void> {
  await fs.rm(path.join(uploadsRoot(), "listings", listingId), {
    recursive: true,
    force: true,
  });
}

export async function readStoredPhoto(
  photoId: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const photo = await prisma.listingPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return null;
  if (photo.mimeType !== "image/jpeg" && photo.mimeType !== "image/png") {
    return null;
  }

  const root = uploadsRoot();
  const absolute = path.resolve(root, photo.storagePath);
  if (!absolute.startsWith(root + path.sep)) return null;

  try {
    const bytes = await fs.readFile(absolute);
    return { bytes, mimeType: photo.mimeType };
  } catch {
    return null;
  }
}
