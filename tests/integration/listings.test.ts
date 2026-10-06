import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { myListingsFor } from "@/server/guards";
import {
  createListing,
  deleteListing,
  listMyListings,
  readPhotos,
  rejectPhotoChange,
  updateListing,
  type IncomingPhoto,
} from "@/server/listings";
import { prisma } from "@/server/db";
import {
  createCategory,
  createUser,
  listingDirNames,
  resetDatabase,
  tinyJpeg,
  tinyPng,
} from "./helpers";

const baseFields = {
  title: "Charizard Holo",
  condition: "NearMint",
  description: "A holo from a binder.",
  conditionNotes: "",
  estimatedValue: "12.50",
  lookingFor: "Vintage coins",
};

function jpegPhoto(): IncomingPhoto {
  return { mimeType: "image/jpeg", bytes: tinyJpeg() };
}

function jpegFile(name: string): File {
  const bytes = tinyJpeg();
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new File([copy], name, { type: "image/jpeg" });
}

describe("listings", () => {
  beforeEach(resetDatabase);

  it("creates an available listing with photo files", async () => {
    const owner = await createUser();
    const category = await createCategory();
    const created = await createListing(
      owner.id,
      { ...baseFields, categoryId: category.id },
      [jpegPhoto(), jpegPhoto()],
    );

    const listing = await prisma.listing.findUnique({
      where: { id: created.id },
      include: { photos: { orderBy: { sortOrder: "asc" } } },
    });
    expect(listing?.status).toBe("Available");
    expect(listing?.ownerId).toBe(owner.id);
    expect(listing?.estimatedValueCents).toBe(1250);
    expect(listing?.photos).toHaveLength(2);
    expect(listing?.photos.map((photo) => photo.sortOrder)).toEqual([0, 1]);

    for (const photo of listing?.photos ?? []) {
      expect(photo.storagePath).toBe(`listings/${created.id}/${photo.id}.jpg`);
      expect(photo.mimeType).toBe("image/jpeg");
      const absolute = path.join(process.cwd(), "uploads", photo.storagePath);
      const bytes = await fs.readFile(absolute);
      expect(bytes[0]).toBe(0xff);
      expect(
        await fs
          .access(path.join(process.cwd(), "public", photo.storagePath))
          .then(() => true)
          .catch(() => false),
      ).toBe(false);
    }
  });

  it("stores a png with a png extension", async () => {
    const owner = await createUser();
    const category = await createCategory();
    const created = await createListing(owner.id, { ...baseFields, categoryId: category.id }, [
      { mimeType: "image/png", bytes: tinyPng() },
    ]);
    const photo = await prisma.listingPhoto.findFirst({ where: { listingId: created.id } });
    expect(photo?.storagePath.endsWith(".png")).toBe(true);
    expect(photo?.mimeType).toBe("image/png");
  });

  it("rejects bad photos before any listing or file is left behind", async () => {
    const owner = await createUser();
    const category = await createCategory();
    const fields = { ...baseFields, categoryId: category.id };
    const beforeDirs = await listingDirNames();

    const empty = new FormData();
    await expect(readPhotos(empty)).rejects.toBeInstanceOf(DomainError);

    const four = new FormData();
    for (let index = 0; index < 4; index += 1) {
      four.append("photos", jpegFile(`p${index}.jpg`));
    }
    await expect(readPhotos(four)).rejects.toBeInstanceOf(DomainError);

    const text = new FormData();
    text.append("photos", new File(["hello"], "note.txt", { type: "text/plain" }));
    await expect(readPhotos(text)).rejects.toBeInstanceOf(DomainError);

    const huge = new Uint8Array(5 * 1024 * 1024 + 1);
    huge.set(tinyJpeg().subarray(0, 4), 0);
    const oversize = new FormData();
    oversize.append("photos", new File([huge], "big.jpg", { type: "image/jpeg" }));
    await expect(readPhotos(oversize)).rejects.toBeInstanceOf(DomainError);

    await expect(
      createListing(owner.id, fields, [{ mimeType: "image/gif", bytes: tinyJpeg() }]),
    ).rejects.toBeInstanceOf(DomainError);

    expect(await prisma.listing.count()).toBe(0);
    expect(await listingDirNames()).toEqual(beforeDirs);
  });

  it("rejects an unknown category before writing photos", async () => {
    const owner = await createUser();
    const beforeDirs = await listingDirNames();
    await expect(
      createListing(owner.id, { ...baseFields, categoryId: "missing" }, [jpegPhoto()]),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_FOUND" });
    expect(await prisma.listing.count()).toBe(0);
    expect(await listingDirNames()).toEqual(beforeDirs);
  });

  it("updates unlocked fields and deletes an unlocked listing with its files", async () => {
    const owner = await createUser();
    const category = await createCategory();
    const created = await createListing(owner.id, { ...baseFields, categoryId: category.id }, [
      jpegPhoto(),
    ]);
    const beforePhotos = await prisma.listingPhoto.findMany({ where: { listingId: created.id } });
    const beforeBytes = await fs.readFile(
      path.join(process.cwd(), "uploads", beforePhotos[0].storagePath),
    );

    await updateListing(owner.id, created.id, {
      ...baseFields,
      categoryId: category.id,
      title: "Updated title",
      estimatedValue: "",
      conditionNotes: "  ",
      lookingFor: "",
    });

    const updated = await prisma.listing.findUnique({ where: { id: created.id } });
    const afterPhotos = await prisma.listingPhoto.findMany({ where: { listingId: created.id } });
    expect(updated?.title).toBe("Updated title");
    expect(updated?.estimatedValueCents).toBeNull();
    expect(updated?.conditionNotes).toBeNull();
    expect(updated?.lookingFor).toBeNull();
    expect(afterPhotos.map((photo) => photo.id)).toEqual(beforePhotos.map((photo) => photo.id));
    const afterBytes = await fs.readFile(
      path.join(process.cwd(), "uploads", beforePhotos[0].storagePath),
    );
    expect(Buffer.compare(beforeBytes, afterBytes)).toBe(0);

    await deleteListing(owner.id, created.id);
    expect(await prisma.listing.findUnique({ where: { id: created.id } })).toBeNull();
    expect(await prisma.listingPhoto.count({ where: { listingId: created.id } })).toBe(0);
    await expect(
      fs.access(path.join(process.cwd(), "uploads", "listings", created.id)),
    ).rejects.toThrow();
  });

  it("rejects a photo change and leaves the photo set in place", async () => {
    const owner = await createUser();
    const category = await createCategory();
    const created = await createListing(owner.id, { ...baseFields, categoryId: category.id }, [
      jpegPhoto(),
    ]);
    const form = new FormData();
    form.set("listingId", created.id);
    form.append("photos", jpegFile("extra.jpg"));
    expect(() => rejectPhotoChange(form)).toThrow(DomainError);

    const photos = await prisma.listingPhoto.findMany({ where: { listingId: created.id } });
    expect(photos).toHaveLength(1);
    await expect(
      fs.access(path.join(process.cwd(), "uploads", photos[0].storagePath)),
    ).resolves.toBeUndefined();
  });

  it("rejects edit and delete when the listing is pending, in trade, or traded", async () => {
    const owner = await createUser();
    const other = await createUser({ displayName: "Other" });
    const category = await createCategory();
    const target = await createListing(owner.id, { ...baseFields, categoryId: category.id, title: "Target" }, [
      jpegPhoto(),
    ]);
    const offered = await createListing(
      other.id,
      { ...baseFields, categoryId: category.id, title: "Offered" },
      [jpegPhoto()],
    );
    await prisma.tradeOffer.create({
      data: {
        proposerId: other.id,
        receiverId: owner.id,
        targetListingId: target.id,
        status: "Pending",
        items: { create: [{ listingId: offered.id }] },
      },
    });

    await expect(
      updateListing(owner.id, target.id, { ...baseFields, categoryId: category.id, title: "Nope" }),
    ).rejects.toMatchObject({ code: "LISTING_LOCKED" });
    await expect(deleteListing(other.id, offered.id)).rejects.toMatchObject({
      code: "LISTING_LOCKED",
    });
    expect((await prisma.listing.findUnique({ where: { id: target.id } }))?.title).toBe("Target");

    const inTrade = await createListing(
      owner.id,
      { ...baseFields, categoryId: category.id, title: "In trade" },
      [jpegPhoto()],
    );
    await prisma.listing.update({ where: { id: inTrade.id }, data: { status: "InTrade" } });
    await expect(
      updateListing(owner.id, inTrade.id, { ...baseFields, categoryId: category.id, title: "Nope" }),
    ).rejects.toMatchObject({ code: "LISTING_LOCKED" });

    const traded = await createListing(
      owner.id,
      { ...baseFields, categoryId: category.id, title: "Traded" },
      [jpegPhoto()],
    );
    await prisma.listing.update({ where: { id: traded.id }, data: { status: "Traded" } });
    await expect(deleteListing(owner.id, traded.id)).rejects.toMatchObject({
      code: "LISTING_LOCKED",
    });
    expect(await prisma.listing.findUnique({ where: { id: traded.id } })).not.toBeNull();
  });

  it("rejects a non-owner", async () => {
    const owner = await createUser();
    const stranger = await createUser({ displayName: "Stranger" });
    const category = await createCategory();
    const created = await createListing(owner.id, { ...baseFields, categoryId: category.id }, [
      jpegPhoto(),
    ]);
    await expect(
      updateListing(stranger.id, created.id, {
        ...baseFields,
        categoryId: category.id,
        title: "Stolen",
      }),
    ).rejects.toMatchObject({ code: "NOT_OWNER" });
    expect((await prisma.listing.findUnique({ where: { id: created.id } }))?.title).toBe(
      "Charizard Holo",
    );
  });

  it("rejects over-limit text on create and edit", async () => {
    const owner = await createUser();
    const category = await createCategory();
    const created = await createListing(owner.id, { ...baseFields, categoryId: category.id }, [
      jpegPhoto(),
    ]);
    const cases = [
      { title: "a".repeat(101) },
      { description: "a".repeat(2001) },
      { lookingFor: "a".repeat(301) },
      { conditionNotes: "a".repeat(301) },
    ];
    for (const extra of cases) {
      await expect(
        updateListing(owner.id, created.id, { ...baseFields, categoryId: category.id, ...extra }),
      ).rejects.toBeInstanceOf(DomainError);
    }
    expect((await prisma.listing.findUnique({ where: { id: created.id } }))?.title).toBe(
      "Charizard Holo",
    );
  });

  it("stores dollar inputs as cents and rejects invalid amounts", async () => {
    const owner = await createUser();
    const category = await createCategory();
    const created = await createListing(
      owner.id,
      { ...baseFields, categoryId: category.id, estimatedValue: "12" },
      [jpegPhoto()],
    );
    expect((await prisma.listing.findUnique({ where: { id: created.id } }))?.estimatedValueCents).toBe(
      1200,
    );

    await updateListing(owner.id, created.id, {
      ...baseFields,
      categoryId: category.id,
      estimatedValue: "12.5",
    });
    expect((await prisma.listing.findUnique({ where: { id: created.id } }))?.estimatedValueCents).toBe(
      1250,
    );

    for (const estimatedValue of ["-1", "12.345"]) {
      await expect(
        updateListing(owner.id, created.id, { ...baseFields, categoryId: category.id, estimatedValue }),
      ).rejects.toMatchObject({ code: "INVALID_ESTIMATED_VALUE" });
    }
    expect((await prisma.listing.findUnique({ where: { id: created.id } }))?.estimatedValueCents).toBe(
      1250,
    );
  });

  it("lists every own status and shows edit controls only when unlocked", async () => {
    const owner = await createUser();
    const other = await createUser({ displayName: "Other" });
    const category = await createCategory();
    const unlocked = await createListing(
      owner.id,
      { ...baseFields, categoryId: category.id, title: "Unlocked" },
      [jpegPhoto()],
    );
    const pendingTarget = await createListing(
      owner.id,
      { ...baseFields, categoryId: category.id, title: "Pending" },
      [jpegPhoto()],
    );
    const inTrade = await createListing(
      owner.id,
      { ...baseFields, categoryId: category.id, title: "Trading" },
      [jpegPhoto()],
    );
    const traded = await createListing(
      owner.id,
      { ...baseFields, categoryId: category.id, title: "Done" },
      [jpegPhoto()],
    );
    const hidden = await createListing(
      other.id,
      { ...baseFields, categoryId: category.id, title: "Not mine" },
      [jpegPhoto()],
    );
    await prisma.listing.update({ where: { id: inTrade.id }, data: { status: "InTrade" } });
    await prisma.listing.update({ where: { id: traded.id }, data: { status: "Traded" } });
    await prisma.tradeOffer.create({
      data: {
        proposerId: other.id,
        receiverId: owner.id,
        targetListingId: pendingTarget.id,
        status: "Pending",
      },
    });

    const mine = await listMyListings(owner.id);
    expect(mine.map((listing) => listing.title).sort()).toEqual([
      "Done",
      "Pending",
      "Trading",
      "Unlocked",
    ]);
    expect(mine.find((listing) => listing.id === hidden.id)).toBeUndefined();
    expect(mine.find((listing) => listing.id === unlocked.id)).toMatchObject({
      showEdit: true,
      showDelete: true,
    });
    for (const title of ["Pending", "Trading", "Done"]) {
      expect(mine.find((listing) => listing.title === title)).toMatchObject({
        showEdit: false,
        showDelete: false,
      });
    }

    const blocked = await myListingsFor({
      ok: false,
      error: { code: "AUTH_REQUIRED", message: "Sign in required." },
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked).not.toHaveProperty("listings");
  });
});
