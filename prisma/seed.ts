import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcrypt";
import { prisma } from "../src/server/db";
import {
  DEMO_PASSWORD,
  categories,
  categoryFixtureFile,
  listingDescription,
  listings,
  offers,
  photoStoragePath,
  ratings,
  users,
} from "./seed-data";

const assetDir = path.join(process.cwd(), "prisma", "seed-assets");
const uploadsListingsDir = path.join(process.cwd(), "uploads", "listings");

async function assertFixturesExist() {
  for (const category of categories) {
    const fixturePath = path.join(assetDir, categoryFixtureFile(category.id));
    try {
      await fs.access(fixturePath);
    } catch {
      throw new Error(`Missing seed fixture: ${fixturePath}`);
    }
  }
}

async function copyPhotos() {
  for (const listing of listings) {
    const source = path.join(assetDir, categoryFixtureFile(listing.categoryId));
    for (const photoId of listing.photoIds) {
      const destination = path.join(
        process.cwd(),
        "uploads",
        photoStoragePath(listing.id, photoId),
      );
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(source, destination);
    }
  }
}

async function main() {
  await assertFixturesExist();

  await prisma.rating.deleteMany();
  await prisma.tradeOfferItem.deleteMany();
  await prisma.tradeOffer.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await fs.rm(uploadsListingsDir, { recursive: true, force: true });

  await copyPhotos();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      await tx.user.create({
        data: {
          id: user.id,
          email: user.email,
          passwordHash,
          displayName: user.displayName,
          city: user.city,
        },
      });
    }

    for (const category of categories) {
      await tx.category.create({ data: category });
    }

    for (const listing of listings) {
      await tx.listing.create({
        data: {
          id: listing.id,
          ownerId: listing.ownerId,
          categoryId: listing.categoryId,
          title: listing.title,
          description: listingDescription(listing.title),
          condition: listing.condition,
          conditionNotes: listing.conditionNotes,
          estimatedValueCents: listing.estimatedValueCents,
          lookingFor: listing.lookingFor,
          status: listing.status,
          photos: {
            create: listing.photoIds.map((photoId, sortOrder) => ({
              id: photoId,
              storagePath: photoStoragePath(listing.id, photoId),
              sortOrder,
              mimeType: "image/jpeg",
            })),
          },
        },
      });
    }

    for (const offer of offers) {
      await tx.tradeOffer.create({
        data: {
          id: offer.id,
          proposerId: offer.proposerId,
          receiverId: offer.receiverId,
          targetListingId: offer.targetListingId,
          status: offer.status,
          cancelledBy: offer.cancelledBy,
          proposerReceivedAt: offer.proposerReceivedAt
            ? new Date(offer.proposerReceivedAt)
            : null,
          receiverReceivedAt: offer.receiverReceivedAt
            ? new Date(offer.receiverReceivedAt)
            : null,
          createdAt: new Date(offer.createdAt),
          updatedAt: new Date(offer.updatedAt),
          items: {
            create: offer.items.map((item) => ({
              id: item.id,
              listingId: item.listingId,
            })),
          },
        },
      });
    }

    for (const rating of ratings) {
      await tx.rating.create({
        data: {
          id: rating.id,
          tradeOfferId: rating.tradeOfferId,
          raterUserId: rating.raterUserId,
          ratedUserId: rating.ratedUserId,
          score: rating.score,
          comment: rating.comment,
          createdAt: new Date(rating.createdAt),
        },
      });
    }
  });

  const storedUsers = await prisma.user.findMany();
  for (const user of storedUsers) {
    const matches = await bcrypt.compare(DEMO_PASSWORD, user.passwordHash);
    if (!matches) {
      throw new Error(`Seeded password hash does not match DemoPass1 for ${user.id}`);
    }
    if (user.passwordHash.includes(DEMO_PASSWORD)) {
      throw new Error(`Plaintext password stored for ${user.id}`);
    }
  }

  for (const listing of listings) {
    for (const photoId of listing.photoIds) {
      const relative = photoStoragePath(listing.id, photoId);
      await fs.access(path.join(process.cwd(), "uploads", relative));
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
