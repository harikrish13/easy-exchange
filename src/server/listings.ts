import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Prisma } from "../../generated/prisma/client";
import { DomainError } from "@/domain/errors";
import {
  PHOTO_MAX_BYTES,
  centsToDollarInput,
  isListingLocked,
  listingControls,
  parseListingFields,
  statusLabel,
  validatePhotoSet,
  type ListingFieldInput,
  type ListingStatusValue,
} from "@/domain/listings";
import { listingFormSchema } from "@/lib/listing-schema";
import { formString } from "@/lib/form-string";
import { prisma } from "./db";
import { removeListingFiles, uploadsRoot, writePhotoFiles } from "./photos";

export type IncomingPhoto = {
  mimeType: string;
  bytes: Uint8Array;
};

export type MyListing = {
  id: string;
  title: string;
  status: ListingStatusValue;
  statusLabel: string;
  categoryName: string;
  photoId: string | null;
  locked: boolean;
  showEdit: boolean;
  showDelete: boolean;
};

const LOCKED_MESSAGE =
  "This listing can't be edited or deleted while it's part of a pending offer or a trade.";

function extensionFor(mimeType: string): "jpg" | "png" {
  return mimeType === "image/png" ? "png" : "jpg";
}

function isForeignKeyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003"
  );
}

async function pendingOfferExists(
  listingId: string,
  db: Pick<typeof prisma, "tradeOffer"> = prisma,
): Promise<boolean> {
  const pending = await db.tradeOffer.findFirst({
    where: {
      status: "Pending",
      OR: [
        { targetListingId: listingId },
        { items: { some: { listingId } } },
      ],
    },
    select: { id: true },
  });
  return pending !== null;
}

export function readListingForm(formData: FormData): ListingFieldInput {
  return listingFormSchema.parse({
    title: formString(formData, "title"),
    categoryId: formString(formData, "categoryId"),
    condition: formString(formData, "condition"),
    description: formString(formData, "description"),
    conditionNotes: formString(formData, "conditionNotes"),
    estimatedValue: formString(formData, "estimatedValue"),
    lookingFor: formString(formData, "lookingFor"),
  });
}

function realFiles(formData: FormData): File[] {
  return formData.getAll("photos").filter((entry): entry is File => {
    return entry instanceof File && !(entry.size === 0 && entry.name.trim() === "");
  });
}

export function rejectPhotoChange(formData: FormData): void {
  if (realFiles(formData).length > 0) {
    throw new DomainError(
      "PHOTO_SET_CHANGE",
      "Photos are set when you list an item and can't be changed.",
    );
  }
}

export async function readPhotos(formData: FormData): Promise<IncomingPhoto[]> {
  const files = realFiles(formData);
  if (files.length < 1 || files.length > 3) {
    throw new DomainError("INVALID_PHOTOS", "Add 1 to 3 photos.");
  }

  const photos: IncomingPhoto[] = [];
  for (const file of files) {
    if (file.size > PHOTO_MAX_BYTES) {
      throw new DomainError("INVALID_PHOTOS", "Each photo must be 5 MB or smaller.");
    }
    photos.push({
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  }

  validatePhotoSet(
    photos.map((photo) => ({
      mimeType: photo.mimeType,
      sizeBytes: photo.bytes.byteLength,
      header: photo.bytes.subarray(0, 8),
    })),
  );
  return photos;
}

async function assertCategory(categoryId: string): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new DomainError("CATEGORY_NOT_FOUND", "Choose a category from the list.");
  }
}

export async function createListing(
  ownerId: string,
  input: ListingFieldInput,
  photos: IncomingPhoto[],
): Promise<{ id: string }> {
  const fields = parseListingFields(input);
  validatePhotoSet(
    photos.map((photo) => ({
      mimeType: photo.mimeType,
      sizeBytes: photo.bytes.byteLength,
      header: photo.bytes.subarray(0, 8),
    })),
  );
  await assertCategory(fields.categoryId);

  const listing = await prisma.listing.create({
    data: {
      ownerId,
      categoryId: fields.categoryId,
      title: fields.title,
      description: fields.description,
      condition: fields.condition,
      conditionNotes: fields.conditionNotes,
      estimatedValueCents: fields.estimatedValueCents,
      lookingFor: fields.lookingFor,
      status: "Available",
    },
    select: { id: true },
  });

  const directory = path.join(uploadsRoot(), "listings", listing.id);
  try {
    await fs.mkdir(directory, { recursive: true });
    const rows = photos.map((photo, sortOrder) => {
      const photoId = randomUUID();
      const extension = extensionFor(photo.mimeType);
      const filename = `${photoId}.${extension}`;
      return {
        id: photoId,
        listingId: listing.id,
        storagePath: `listings/${listing.id}/${filename}`,
        sortOrder,
        mimeType: photo.mimeType,
        absolutePath: path.join(directory, filename),
        bytes: photo.bytes,
      };
    });

    await writePhotoFiles(
      rows.map((row) => ({ absolutePath: row.absolutePath, bytes: row.bytes })),
    );
    await prisma.listingPhoto.createMany({
      data: rows.map((row) => ({
        id: row.id,
        listingId: row.listingId,
        storagePath: row.storagePath,
        sortOrder: row.sortOrder,
        mimeType: row.mimeType,
      })),
    });
  } catch (error) {
    await prisma.listingPhoto.deleteMany({ where: { listingId: listing.id } }).catch(() => undefined);
    await prisma.listing.delete({ where: { id: listing.id } }).catch(() => undefined);
    await removeListingFiles(listing.id);
    throw error;
  }

  return { id: listing.id };
}

export async function updateListing(
  ownerId: string,
  listingId: string,
  input: ListingFieldInput,
): Promise<{ id: string }> {
  const fields = parseListingFields(input);
  await assertCategory(fields.categoryId);

  await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      throw new DomainError("NOT_FOUND", "That listing doesn't exist.");
    }
    if (listing.ownerId !== ownerId) {
      throw new DomainError("NOT_OWNER", "You can only change your own listings.");
    }

    const locked = isListingLocked({
      status: listing.status,
      inPendingOffer: await pendingOfferExists(listingId, tx),
    });
    if (locked) {
      throw new DomainError("LISTING_LOCKED", LOCKED_MESSAGE);
    }

    await tx.listing.update({
      where: { id: listingId },
      data: {
        title: fields.title,
        categoryId: fields.categoryId,
        condition: fields.condition,
        description: fields.description,
        conditionNotes: fields.conditionNotes,
        estimatedValueCents: fields.estimatedValueCents,
        lookingFor: fields.lookingFor,
      },
    });
  });

  return { id: listingId };
}

export async function deleteListing(ownerId: string, listingId: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: listingId } });
      if (!listing) {
        throw new DomainError("NOT_FOUND", "That listing doesn't exist.");
      }
      if (listing.ownerId !== ownerId) {
        throw new DomainError("NOT_OWNER", "You can only change your own listings.");
      }

      const locked = isListingLocked({
        status: listing.status,
        inPendingOffer: await pendingOfferExists(listingId, tx),
      });
      if (locked) {
        throw new DomainError("LISTING_LOCKED", LOCKED_MESSAGE);
      }

      await tx.listingPhoto.deleteMany({ where: { listingId } });
      await tx.listing.delete({ where: { id: listingId } });
    });
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new DomainError(
        "LISTING_IN_USE",
        "This listing is part of an offer and can't be deleted.",
      );
    }
    throw error;
  }

  await removeListingFiles(listingId);
}

export async function listMyListings(ownerId: string): Promise<MyListing[]> {
  const listings = await prisma.listing.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
      photos: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  const ids = listings.map((listing) => listing.id);
  const pending = ids.length
    ? await prisma.tradeOffer.findMany({
        where: {
          status: "Pending",
          OR: [
            { targetListingId: { in: ids } },
            { items: { some: { listingId: { in: ids } } } },
          ],
        },
        select: {
          targetListingId: true,
          items: { select: { listingId: true } },
        },
      })
    : [];

  const pendingIds = new Set<string>();
  for (const offer of pending) {
    pendingIds.add(offer.targetListingId);
    for (const item of offer.items) pendingIds.add(item.listingId);
  }

  return listings.map((listing) => {
    const locked = isListingLocked({
      status: listing.status,
      inPendingOffer: pendingIds.has(listing.id),
    });
    const controls = listingControls(locked);
    return {
      id: listing.id,
      title: listing.title,
      status: listing.status,
      statusLabel: statusLabel(listing.status),
      categoryName: listing.category.name,
      photoId: listing.photos[0]?.id ?? null,
      locked,
      showEdit: controls.showEdit,
      showDelete: controls.showDelete,
    };
  });
}

export async function getOwnedListing(listingId: string, ownerId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      photos: { orderBy: { sortOrder: "asc" }, select: { id: true } },
    },
  });
  if (!listing) return { kind: "missing" as const };
  if (listing.ownerId !== ownerId) return { kind: "not-owner" as const };

  const locked = isListingLocked({
    status: listing.status,
    inPendingOffer: await pendingOfferExists(listing.id),
  });

  return {
    kind: "ok" as const,
    listing: {
      id: listing.id,
      title: listing.title,
      categoryId: listing.categoryId,
      condition: listing.condition,
      description: listing.description,
      conditionNotes: listing.conditionNotes ?? "",
      estimatedValue: centsToDollarInput(listing.estimatedValueCents),
      lookingFor: listing.lookingFor ?? "",
      photoIds: listing.photos.map((photo) => photo.id),
      locked,
    },
  };
}
