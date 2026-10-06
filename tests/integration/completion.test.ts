import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { cancelTrade, declineTrade } from "@/server/offers";
import { getOfferDetail, leaveRating, markItemReceived } from "@/server/completion";
import { prisma } from "@/server/db";
import { createCategory, createUser, resetDatabase } from "./helpers";

async function seedAccepted() {
  const proposer = await createUser({ displayName: "Alex Rivera", city: "Portland" });
  const receiver = await createUser({ displayName: "Jordan Lee", city: "Austin" });
  const stranger = await createUser({ displayName: "Sam Patel", city: null });
  const category = await createCategory();
  const listing = (ownerId: string, title: string) =>
    prisma.listing.create({
      data: {
        ownerId,
        categoryId: category.id,
        title,
        description: "A collectible for the shelf.",
        condition: "Good",
        status: "InTrade",
      },
    });
  const target = await listing(receiver.id, "Charizard");
  const offered = await listing(proposer.id, "Morgan Dollar");
  const offer = await prisma.tradeOffer.create({
    data: {
      proposerId: proposer.id,
      receiverId: receiver.id,
      targetListingId: target.id,
      status: "Accepted",
      items: { create: [{ listingId: offered.id }] },
    },
  });
  return { proposer, receiver, stranger, target, offered, offer };
}

describe("trade completion and ratings", () => {
  beforeEach(resetDatabase);

  it("keeps the trade accepted after the first mark, then completes it on the second", async () => {
    const { proposer, receiver, target, offered, offer } = await seedAccepted();

    await markItemReceived(proposer.id, offer.id);
    const once = await prisma.tradeOffer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(once.status).toBe("Accepted");
    expect(once.proposerReceivedAt).not.toBeNull();
    expect(once.receiverReceivedAt).toBeNull();
    expect(await prisma.listing.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({
      status: "InTrade",
    });
    expect(await prisma.listing.findUniqueOrThrow({ where: { id: offered.id } })).toMatchObject({
      status: "InTrade",
    });

    await markItemReceived(proposer.id, offer.id);
    const again = await prisma.tradeOffer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(again.proposerReceivedAt?.getTime()).toBe(once.proposerReceivedAt?.getTime());
    expect(again.status).toBe("Accepted");

    await markItemReceived(receiver.id, offer.id);
    const done = await prisma.tradeOffer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(done.status).toBe("Completed");
    expect(done.proposerReceivedAt).not.toBeNull();
    expect(done.receiverReceivedAt).not.toBeNull();
    const listings = await prisma.listing.findMany({
      where: { id: { in: [target.id, offered.id] } },
    });
    expect(listings).toHaveLength(2);
    expect(listings.map((item) => item.status).sort()).toEqual(["Traded", "Traded"]);
    expect(await prisma.rating.count()).toBe(0);

    await markItemReceived(receiver.id, offer.id);
    const still = await prisma.tradeOffer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(still.status).toBe("Completed");
    expect(still.receiverReceivedAt?.getTime()).toBe(done.receiverReceivedAt?.getTime());
  });

  it("rejects cancel, decline, strangers, and ratings before completion", async () => {
    const { proposer, receiver, stranger, offer } = await seedAccepted();

    await expect(cancelTrade(proposer.id, offer.id)).rejects.toMatchObject({ code: "NO_REOPEN" });
    await expect(declineTrade(receiver.id, offer.id)).rejects.toMatchObject({ code: "NO_REOPEN" });
    const staying = await prisma.tradeOffer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(staying.status).toBe("Accepted");

    await expect(markItemReceived(stranger.id, offer.id)).rejects.toBeInstanceOf(DomainError);
    await expect(leaveRating(proposer.id, { tradeOfferId: offer.id, score: 5, comment: "" })).rejects.toMatchObject({
      code: "NOT_COMPLETED",
    });
    expect(await prisma.rating.count()).toBe(0);

    await markItemReceived(proposer.id, offer.id);
    await markItemReceived(receiver.id, offer.id);
    await expect(cancelTrade(proposer.id, offer.id)).rejects.toMatchObject({ code: "NO_REOPEN" });
    await expect(
      leaveRating(stranger.id, { tradeOfferId: offer.id, score: 5, comment: "" }),
    ).rejects.toMatchObject({ code: "WRONG_ACTOR" });
  });

  it("stores one rating for the other party and rejects a second, an edit, or a long comment", async () => {
    const { proposer, receiver, offer } = await seedAccepted();
    await markItemReceived(proposer.id, offer.id);
    await markItemReceived(receiver.id, offer.id);

    await expect(
      leaveRating(proposer.id, {
        tradeOfferId: offer.id,
        score: 4,
        comment: "a".repeat(501),
      }),
    ).rejects.toThrow();
    expect(await prisma.rating.count()).toBe(0);

    await leaveRating(proposer.id, {
      tradeOfferId: offer.id,
      score: 4,
      comment: "  Fair swap.  ",
    });
    const stored = await prisma.rating.findFirstOrThrow();
    expect(stored).toMatchObject({
      raterUserId: proposer.id,
      ratedUserId: receiver.id,
      score: 4,
      comment: "Fair swap.",
    });

    await expect(
      leaveRating(proposer.id, { tradeOfferId: offer.id, score: 1, comment: "Changed" }),
    ).rejects.toMatchObject({ code: "ALREADY_RATED" });
    const unchanged = await prisma.rating.findFirstOrThrow();
    expect(unchanged.score).toBe(4);
    expect(unchanged.comment).toBe("Fair swap.");

    await leaveRating(receiver.id, {
      tradeOfferId: offer.id,
      score: 5,
      comment: `${"b".repeat(500)}`,
    });
    const blank = await leaveRating(receiver.id, {
      tradeOfferId: offer.id,
      score: 2,
      comment: "   ",
    }).then(
      () => "stored",
      () => "rejected",
    );
    expect(blank).toBe("rejected");
    const receiverRating = await prisma.rating.findFirstOrThrow({
      where: { raterUserId: receiver.id },
    });
    expect(receiverRating.comment).toHaveLength(500);
    expect(receiverRating.ratedUserId).toBe(proposer.id);
  });

  it("shows the rating form only after the trade is completed", async () => {
    const { proposer, receiver, stranger, offer } = await seedAccepted();

    const accepted = await getOfferDetail(proposer.id, offer.id);
    expect(accepted).toMatchObject({
      markReceivedVisible: true,
      ratingFormVisible: false,
      ratingsVisible: false,
      ratings: [],
    });
    expect(await getOfferDetail(stranger.id, offer.id)).toBeNull();

    await markItemReceived(proposer.id, offer.id);
    const waiting = await getOfferDetail(proposer.id, offer.id);
    expect(waiting).toMatchObject({
      youMarkedReceived: true,
      waitingOnOther: true,
      markReceivedVisible: false,
      ratingFormVisible: false,
      ratingsVisible: false,
    });

    await markItemReceived(receiver.id, offer.id);
    const open = await getOfferDetail(receiver.id, offer.id);
    expect(open).toMatchObject({
      status: "Completed",
      markReceivedVisible: false,
      ratingFormVisible: true,
      ratingsVisible: true,
    });

    await leaveRating(receiver.id, { tradeOfferId: offer.id, score: 3, comment: "" });
    const rated = await getOfferDetail(receiver.id, offer.id);
    expect(rated?.ratingFormVisible).toBe(false);
    expect(rated?.ratings).toEqual([
      {
        id: expect.any(String),
        raterName: "Jordan Lee",
        ratedName: "Alex Rivera",
        score: 3,
        comment: null,
      },
    ]);
    expect(JSON.stringify(rated)).not.toContain("@");

    const page = await fs.readFile(path.join(process.cwd(), "src/app/offers/[id]/page.tsx"), "utf8");
    const server = await fs.readFile(path.join(process.cwd(), "src/server/completion.ts"), "utf8");
    const actions = await fs.readFile(
      path.join(process.cwd(), "src/server/actions/completion.ts"),
      "utf8",
    );
    expect(page).toContain("ratingFormVisible");
    expect(page).toContain("markReceivedVisible");
    expect(`${page}\n${server}\n${actions}`).not.toMatch(/rating\.(update|delete)|Edit rating|Delete rating/);
  });
});
