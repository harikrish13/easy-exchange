import { beforeEach, describe, expect, it } from "vitest";
import { makeOfferHref, showMakeOffer } from "@/domain/listings";
import { getListingDetail, listCatalog } from "@/server/catalog";
import { createListing, type IncomingPhoto } from "@/server/listings";
import { prisma } from "@/server/db";
import { createCategory, createUser, resetDatabase, tinyJpeg } from "./helpers";

const jpeg = (): IncomingPhoto => ({ mimeType: "image/jpeg", bytes: tinyJpeg() });

async function listing(input: {
  ownerId: string;
  categoryId: string;
  title: string;
  createdAt: string;
}) {
  const created = await createListing(
    input.ownerId,
    {
      title: input.title,
      categoryId: input.categoryId,
      condition: "Good",
      description: `${input.title} description`,
      conditionNotes: "Small crease",
      estimatedValue: "12.5",
      lookingFor: "Comics",
    },
    [jpeg()],
  );
  await prisma.listing.update({
    where: { id: created.id },
    data: { createdAt: new Date(input.createdAt) },
  });
  return created.id;
}

describe("browse", () => {
  beforeEach(resetDatabase);

  it("returns only available listings, newest first", async () => {
    const owner = await createUser();
    const cards = await createCategory("trading-cards", "Trading Cards");
    const older = await listing({
      ownerId: owner.id,
      categoryId: cards.id,
      title: "Older card",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    const newer = await listing({
      ownerId: owner.id,
      categoryId: cards.id,
      title: "Newer card",
      createdAt: "2024-06-01T00:00:00.000Z",
    });
    const inTrade = await listing({
      ownerId: owner.id,
      categoryId: cards.id,
      title: "Held card",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    const traded = await listing({
      ownerId: owner.id,
      categoryId: cards.id,
      title: "Gone card",
      createdAt: "2025-02-01T00:00:00.000Z",
    });
    await prisma.listing.update({ where: { id: inTrade }, data: { status: "InTrade" } });
    await prisma.listing.update({ where: { id: traded }, data: { status: "Traded" } });

    const catalog = await listCatalog({ viewerId: null, category: null });
    expect(catalog.map((item) => item.id)).toEqual([newer, older]);
    expect(catalog[0]).toMatchObject({
      title: "Newer card",
      categoryName: "Trading Cards",
      conditionLabel: "Good",
    });
    expect(catalog[0].photoId).toEqual(expect.any(String));
  });

  it("omits the signed-in user's listings and filters by category", async () => {
    const alex = await createUser({ displayName: "Alex" });
    const jordan = await createUser({ displayName: "Jordan" });
    const cards = await createCategory("trading-cards", "Trading Cards");
    const coins = await createCategory("coins", "Coins");
    const alexCard = await listing({
      ownerId: alex.id,
      categoryId: cards.id,
      title: "Alex card",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const jordanCoin = await listing({
      ownerId: jordan.id,
      categoryId: coins.id,
      title: "Jordan coin",
      createdAt: "2024-02-01T00:00:00.000Z",
    });

    const shelf = await listCatalog({ viewerId: alex.id, category: null });
    expect(shelf.map((item) => item.id)).toEqual([jordanCoin]);
    expect(shelf.find((item) => item.id === alexCard)).toBeUndefined();

    const coinsOnly = await listCatalog({ viewerId: null, category: "coins" });
    expect(coinsOnly.map((item) => item.title)).toEqual(["Jordan coin"]);
    expect(await listCatalog({ viewerId: null, category: coins.id })).toHaveLength(1);
    expect(await listCatalog({ viewerId: null, category: "missing-category" })).toEqual([]);
  });

  it("shows detail for any status without email, and hides a missing id", async () => {
    const owner = await createUser({ displayName: "Alex Rivera", city: "Portland" });
    const category = await createCategory();
    const id = await listing({
      ownerId: owner.id,
      categoryId: category.id,
      title: "Held figure",
      createdAt: "2024-03-01T00:00:00.000Z",
    });
    await prisma.listing.update({ where: { id }, data: { status: "InTrade" } });

    const detail = await getListingDetail(id);
    expect(detail).toMatchObject({
      title: "Held figure",
      categoryName: "Trading Cards",
      conditionLabel: "Good",
      conditionNotes: "Small crease",
      description: "Held figure description",
      lookingFor: "Comics",
      fairnessHint: "$12.50",
      ownerDisplayName: "Alex Rivera",
      ownerCity: "Portland",
      status: "InTrade",
      statusLabel: "In trade",
    });
    expect(detail).not.toHaveProperty("email");
    expect(JSON.stringify(detail)).not.toContain("@");
    expect(detail?.photos).toHaveLength(1);

    expect(
      showMakeOffer({
        status: detail?.status ?? "Available",
        viewerId: null,
        ownerId: detail?.ownerId ?? "",
      }),
    ).toBe(false);
    expect(await getListingDetail("missing-listing")).toBeNull();
  });

  it("shows Make offer only for someone else's available listing", async () => {
    const owner = await createUser();
    const category = await createCategory();
    const available = await listing({
      ownerId: owner.id,
      categoryId: category.id,
      title: "Open card",
      createdAt: "2024-04-01T00:00:00.000Z",
    });
    const detail = await getListingDetail(available);
    expect(detail?.status).toBe("Available");
    expect(
      showMakeOffer({ status: "Available", viewerId: null, ownerId: owner.id }),
    ).toBe(true);
    expect(makeOfferHref({ viewerId: null, listingId: available })).toBe(
      `/sign-in?callbackUrl=${encodeURIComponent(`/listings/${available}`)}`,
    );
    expect(
      showMakeOffer({ status: "Available", viewerId: owner.id, ownerId: owner.id }),
    ).toBe(false);
    expect(makeOfferHref({ viewerId: "someone", listingId: available })).toBeNull();
    expect(
      showMakeOffer({ status: "Available", viewerId: "someone", ownerId: owner.id }),
    ).toBe(true);
  });
});
