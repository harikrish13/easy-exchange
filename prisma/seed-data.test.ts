import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEMO_PASSWORD,
  categories,
  categoryFixtureFile,
  listings,
  listingDescription,
  offers,
  photoStoragePath,
  ratings,
  users,
} from "./seed-data";

const LIMITS = {
  title: 100,
  description: 2000,
  lookingFor: 300,
  conditionNotes: 300,
  comment: 500,
};

describe("seed catalog", () => {
  it("defines three demo users and the shared password", () => {
    expect(DEMO_PASSWORD).toBe("DemoPass1");
    expect(users.map((user) => user.email)).toEqual([
      "alex@demo.easyexchange.test",
      "jordan@demo.easyexchange.test",
      "sam@demo.easyexchange.test",
    ]);
    expect(users.map((user) => user.displayName)).toEqual([
      "Alex Rivera",
      "Jordan Lee",
      "Sam Patel",
    ]);
    expect(users.find((user) => user.id === "user_sam")?.city).toBeNull();
    expect(users.find((user) => user.id === "user_alex")?.city).toBe(
      "Portland",
    );
    expect(users.find((user) => user.id === "user_jordan")?.city).toBe(
      "Austin",
    );
    for (const user of users) {
      expect(user.email).toBe(user.email.toLowerCase());
      expect(user).not.toHaveProperty("password");
      expect(user).not.toHaveProperty("passwordHash");
      expect(user).not.toHaveProperty("resetToken");
    }
  });

  it("defines the four categories", () => {
    expect(categories).toEqual([
      { id: "cat_cards", name: "Trading Cards", slug: "trading-cards" },
      { id: "cat_coins", name: "Coins", slug: "coins" },
      { id: "cat_figures", name: "Action Figures", slug: "action-figures" },
      { id: "cat_comics", name: "Comics", slug: "comics" },
    ]);
    expect(new Set(categories.map((category) => category.slug)).size).toBe(4);
  });

  it("points every photo at the category fixture and a relative storage path", () => {
    const charizard = listings.find(
      (listing) => listing.id === "listing_alex_charizard",
    );
    expect(charizard?.photoIds).toEqual([
      "photo_alex_charizard_1",
      "photo_alex_charizard_2",
    ]);

    for (const listing of listings) {
      expect(listing.photoIds.length).toBeGreaterThanOrEqual(1);
      expect(listing.photoIds.length).toBeLessThanOrEqual(3);
      listing.photoIds.forEach((photoId, index) => {
        expect(photoStoragePath(listing.id, photoId)).toBe(
          `listings/${listing.id}/${photoId}.jpg`,
        );
        expect(index).toBeGreaterThanOrEqual(0);
      });
      expect(categoryFixtureFile(listing.categoryId)).toMatch(/\.jpg$/);
    }

    expect(categoryFixtureFile("cat_cards")).toBe("trading-cards.jpg");
    const fixtureNames = [
      "trading-cards.jpg",
      "coins.jpg",
      "action-figures.jpg",
      "comics.jpg",
    ];
    for (const name of fixtureNames) {
      const bytes = readFileSync(
        path.join(process.cwd(), "prisma", "seed-assets", name),
      );
      expect(bytes.subarray(0, 2).toString("hex")).toBe("ffd8");
    }
  });

  it("includes every offer status with the catalog ids", () => {
    const byStatus = Object.fromEntries(
      offers.map((offer) => [offer.status, offer.id]),
    );
    expect(byStatus.Pending).toBe("offer_pending");
    expect(offers.filter((offer) => offer.status === "Accepted").map((o) => o.id)).toEqual(
      expect.arrayContaining(["offer_accepted_open", "offer_accepted_partial"]),
    );
    expect(offers.filter((offer) => offer.status === "Declined").map((o) => o.id)).toContain(
      "offer_declined",
    );
    expect(offers.filter((offer) => offer.status === "Cancelled").map((o) => o.id)).toEqual(
      expect.arrayContaining([
        "offer_cancelled_system",
        "offer_cancelled_proposer",
      ]),
    );
    expect(offers.filter((offer) => offer.status === "Completed").map((o) => o.id)).toEqual(
      expect.arrayContaining([
        "offer_completed_rated",
        "offer_completed_unrated",
      ]),
    );
  });

  it("covers both cancel reasons and leaves the system-cancel offered listing available", () => {
    const system = offers.find((offer) => offer.id === "offer_cancelled_system");
    const proposer = offers.find(
      (offer) => offer.id === "offer_cancelled_proposer",
    );
    const accepted = offers.find((offer) => offer.id === "offer_accepted_open");

    expect(system?.cancelledBy).toBe("SYSTEM");
    expect(proposer?.cancelledBy).toBe("PROPOSER");
    expect(system?.targetListingId).toBe("listing_sam_figure");
    expect(system?.targetListingId).toBe(accepted?.targetListingId);
    expect(
      listings.find((listing) => listing.id === "listing_alex_loose_cards")
        ?.status,
    ).toBe("Available");
    for (const offer of offers) {
      if (offer.status !== "Cancelled") {
        expect(offer.cancelledBy).toBeNull();
      }
    }
  });

  it("keeps the two accepted receipt shapes in trade", () => {
    const open = offers.find((offer) => offer.id === "offer_accepted_open");
    const partial = offers.find(
      (offer) => offer.id === "offer_accepted_partial",
    );
    expect(open?.proposerReceivedAt).toBeNull();
    expect(open?.receiverReceivedAt).toBeNull();
    expect(partial?.proposerReceivedAt).toBe("2026-10-01T15:00:00.000Z");
    expect(partial?.receiverReceivedAt).toBeNull();
    expect(open?.status).toBe("Accepted");
    expect(partial?.status).toBe("Accepted");

    for (const id of [
      "listing_sam_figure",
      "listing_jordan_figure",
      "listing_alex_figure",
      "listing_sam_card",
    ]) {
      expect(listings.find((listing) => listing.id === id)?.status).toBe(
        "InTrade",
      );
    }
  });

  it("completes two trades and rates only one of them", () => {
    const rated = offers.find((offer) => offer.id === "offer_completed_rated");
    const unrated = offers.find(
      (offer) => offer.id === "offer_completed_unrated",
    );
    expect(rated?.proposerReceivedAt).not.toBeNull();
    expect(rated?.receiverReceivedAt).not.toBeNull();
    expect(unrated?.proposerReceivedAt).not.toBeNull();
    expect(unrated?.receiverReceivedAt).not.toBeNull();

    for (const id of [
      "listing_alex_coin",
      "listing_jordan_card",
      "listing_jordan_old_comic",
      "listing_sam_coin",
    ]) {
      expect(listings.find((listing) => listing.id === id)?.status).toBe(
        "Traded",
      );
    }

    expect(ratings.filter((rating) => rating.tradeOfferId === rated?.id)).toHaveLength(2);
    expect(
      ratings.filter((rating) => rating.tradeOfferId === unrated?.id),
    ).toHaveLength(0);
    for (const rating of ratings) {
      expect(rating.score).toBeGreaterThanOrEqual(1);
      expect(rating.score).toBeLessThanOrEqual(5);
      expect(rating.raterUserId).not.toBe(rating.ratedUserId);
      expect((rating.comment ?? "").length).toBeLessThanOrEqual(LIMITS.comment);
    }
  });

  it("gives each offer one target, proposer-owned items, and a single pending pair", () => {
    const listingsById = new Map(listings.map((listing) => [listing.id, listing]));
    const pending = offers.filter((offer) => offer.status === "Pending");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe("offer_pending");
    expect(pending[0]?.proposerId).toBe("user_alex");
    expect(pending[0]?.targetListingId).toBe("listing_jordan_morgan");
    expect(pending[0]?.items).toHaveLength(2);

    for (const offer of offers) {
      const target = listingsById.get(offer.targetListingId);
      expect(target).toBeDefined();
      expect(offer.receiverId).toBe(target?.ownerId);
      expect(offer.proposerId).not.toBe(target?.ownerId);
      expect(offer.items.length).toBeGreaterThanOrEqual(1);
      expect(offer.items.length).toBeLessThanOrEqual(3);
      for (const item of offer.items) {
        expect(listingsById.get(item.listingId)?.ownerId).toBe(offer.proposerId);
        expect(item.listingId).not.toBe(offer.targetListingId);
      }
    }
  });

  it("matches listing status rules and demo coverage", () => {
    const involvedIn = (statuses: Array<"Accepted" | "Completed">) => {
      const ids = new Set<string>();
      for (const offer of offers) {
        if (!statuses.includes(offer.status as "Accepted" | "Completed")) {
          continue;
        }
        ids.add(offer.targetListingId);
        for (const item of offer.items) ids.add(item.listingId);
      }
      return ids;
    };
    const completedIds = involvedIn(["Completed"]);
    const acceptedIds = involvedIn(["Accepted"]);

    for (const listing of listings) {
      if (completedIds.has(listing.id)) {
        expect(listing.status).toBe("Traded");
      } else if (acceptedIds.has(listing.id)) {
        expect(listing.status).toBe("InTrade");
      } else {
        expect(listing.status).toBe("Available");
      }
    }

    for (const category of categories) {
      expect(
        listings.some(
          (listing) =>
            listing.categoryId === category.id && listing.status === "Available",
        ),
      ).toBe(true);
    }

    const pendingListingIds = new Set(
      offers
        .filter((offer) => offer.id === "offer_pending")
        .flatMap((offer) => [
          offer.targetListingId,
          ...offer.items.map((item) => item.listingId),
        ]),
    );
    for (const user of users) {
      expect(
        listings.some(
          (listing) =>
            listing.ownerId === user.id &&
            listing.status === "Available" &&
            !pendingListingIds.has(listing.id),
        ),
      ).toBe(true);
    }

    expect(listings.some((listing) => listing.estimatedValueCents !== null)).toBe(
      true,
    );
    expect(listings.some((listing) => listing.estimatedValueCents === null)).toBe(
      true,
    );
    expect(listings.some((listing) => listing.lookingFor !== null)).toBe(true);
    expect(listings.some((listing) => listing.lookingFor === null)).toBe(true);
    expect(
      listings.some(
        (listing) =>
          listing.condition === "Fair" &&
          listing.conditionNotes !== null &&
          listing.conditionNotes.length > 0,
      ),
    ).toBe(true);
    expect(
      listings.find((listing) => listing.id === "listing_alex_charizard")
        ?.estimatedValueCents,
    ).toBe(12000);
  });

  it("keeps catalog text within limits and available-only public rows", () => {
    const guestCatalog = listings.filter(
      (listing) => listing.status === "Available",
    );
    expect(
      guestCatalog.some((listing) => listing.status === "InTrade"),
    ).toBe(false);
    expect(guestCatalog.map((listing) => listing.id)).not.toContain(
      "listing_alex_figure",
    );
    expect(guestCatalog.map((listing) => listing.id)).not.toContain(
      "listing_alex_coin",
    );
    const alexCatalog = guestCatalog.filter(
      (listing) => listing.ownerId !== "user_alex",
    );
    expect(alexCatalog.every((listing) => listing.ownerId !== "user_alex")).toBe(
      true,
    );
    for (const category of categories) {
      expect(
        guestCatalog.some((listing) => listing.categoryId === category.id),
      ).toBe(true);
    }
    const alexListings = listings.filter(
      (listing) => listing.ownerId === "user_alex",
    );
    expect(new Set(alexListings.map((listing) => listing.status))).toEqual(
      new Set(["Available", "InTrade", "Traded"]),
    );

    for (const listing of listings) {
      expect(listing.title.length).toBeLessThanOrEqual(LIMITS.title);
      const description = listingDescription(listing.title);
      expect(description).toBe(
        `${listing.title} from the Easy Exchange demo seed.`,
      );
      expect(description.length).toBeLessThanOrEqual(LIMITS.description);
      expect((listing.lookingFor ?? "").length).toBeLessThanOrEqual(
        LIMITS.lookingFor,
      );
      expect((listing.conditionNotes ?? "").length).toBeLessThanOrEqual(
        LIMITS.conditionNotes,
      );
    }
  });
});
