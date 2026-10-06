import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/photos/[photoId]/route";
import { createListing } from "@/server/listings";
import { prisma } from "@/server/db";
import { createCategory, createUser, resetDatabase, tinyJpeg } from "./helpers";

describe("photo route", () => {
  beforeEach(resetDatabase);

  it("returns photos for every listing status and 404 when the file is missing", async () => {
    const owner = await createUser();
    const category = await createCategory();
    const ids: string[] = [];
    for (const title of ["Open", "Held", "Done"]) {
      const created = await createListing(
        owner.id,
        {
          title,
          categoryId: category.id,
          condition: "Mint",
          description: title,
          conditionNotes: "",
          estimatedValue: "",
          lookingFor: "",
        },
        [{ mimeType: "image/jpeg", bytes: tinyJpeg() }],
      );
      ids.push(created.id);
    }
    await prisma.listing.update({ where: { id: ids[1] }, data: { status: "InTrade" } });
    await prisma.listing.update({ where: { id: ids[2] }, data: { status: "Traded" } });

    const photos = await prisma.listingPhoto.findMany({
      where: { listingId: { in: ids } },
    });
    expect(photos).toHaveLength(3);

    for (const photo of photos) {
      const response = await GET(new Request(`http://localhost/photos/${photo.id}`), {
        params: Promise.resolve({ photoId: photo.id }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      const body = new Uint8Array(await response.arrayBuffer());
      expect(body[0]).toBe(0xff);
      const stored = path.join(process.cwd(), "uploads", photo.storagePath);
      expect(await fs.stat(stored)).toBeTruthy();
      await expect(fs.access(path.join(process.cwd(), "public", photo.storagePath))).rejects.toThrow();
    }

    const missingFile = photos[0];
    await fs.rm(path.join(process.cwd(), "uploads", missingFile.storagePath));
    const missing = await GET(new Request("http://localhost/photos/missing"), {
      params: Promise.resolve({ photoId: missingFile.id }),
    });
    expect(missing.status).toBe(404);

    const unknown = await GET(new Request("http://localhost/photos/nope"), {
      params: Promise.resolve({ photoId: "nope" }),
    });
    expect(unknown.status).toBe(404);
  });
});
