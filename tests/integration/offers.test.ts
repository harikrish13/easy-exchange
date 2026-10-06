import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import {
  acceptTrade,
  cancelTrade,
  declineTrade,
  listOfferHistory,
  proposeTrade,
} from "@/server/offers";
import { prisma } from "@/server/db";
import { createCategory, createUser, resetDatabase } from "./helpers";

async function addListing(
  ownerId: string,
  categoryId: string,
  title: string,
  status: "Available" | "InTrade" | "Traded" = "Available",
) {
  return prisma.listing.create({
    data: {
      ownerId,
      categoryId,
      title,
      description: title,
      condition: "Good",
      status,
    },
  });
}

describe("trade offers", () => {
  beforeEach(resetDatabase);

  it("rejects an offer on the proposer's own listing", async () => {
    const owner = await createUser({ displayName: "Alex" });
    const category = await createCategory();
    const target = await addListing(owner.id, category.id, "Own card");
    const offered = await addListing(owner.id, category.id, "Own coin");

    await expect(
      proposeTrade(owner.id, {
        targetListingId: target.id,
        offeredListingIds: [offered.id],
      }),
    ).rejects.toMatchObject({ code: "OWN_LISTING" });
    expect(await prisma.tradeOffer.count()).toBe(0);
  });

  it("creates a pending offer with the target owner as receiver", async () => {
    const proposer = await createUser({ displayName: "Alex" });
    const receiver = await createUser({ displayName: "Jordan" });
    const category = await createCategory();
    const target = await addListing(receiver.id, category.id, "Target");
    const first = await addListing(proposer.id, category.id, "Offered one");
    const second = await addListing(proposer.id, category.id, "Offered two");

    const created = await proposeTrade(proposer.id, {
      targetListingId: target.id,
      offeredListingIds: [first.id, second.id],
    });
    const offer = await prisma.tradeOffer.findUnique({
      where: { id: created.id },
      include: { items: true },
    });

    expect(offer).toMatchObject({
      status: "Pending",
      cancelledBy: null,
      proposerId: proposer.id,
      receiverId: receiver.id,
      targetListingId: target.id,
      proposerReceivedAt: null,
      receiverReceivedAt: null,
    });
    expect(offer?.items.map((item) => item.listingId).sort()).toEqual([first.id, second.id].sort());
  });

  it("rejects invalid offered items and persists nothing", async () => {
    const proposer = await createUser({ displayName: "Alex" });
    const receiver = await createUser({ displayName: "Jordan" });
    const stranger = await createUser({ displayName: "Sam" });
    const category = await createCategory();
    const target = await addListing(receiver.id, category.id, "Target");
    const mine = await addListing(proposer.id, category.id, "Mine");
    const locked = await addListing(proposer.id, category.id, "Locked", "InTrade");
    const theirs = await addListing(stranger.id, category.id, "Theirs");
    const extra = [
      await addListing(proposer.id, category.id, "A"),
      await addListing(proposer.id, category.id, "B"),
      await addListing(proposer.id, category.id, "C"),
    ];

    const attempts = [
      { targetListingId: target.id, offeredListingIds: [] },
      { targetListingId: target.id, offeredListingIds: [mine.id, ...extra.map((item) => item.id)] },
      { targetListingId: target.id, offeredListingIds: [theirs.id] },
      { targetListingId: target.id, offeredListingIds: [locked.id] },
      { targetListingId: target.id, offeredListingIds: [mine.id, mine.id] },
      { targetListingId: target.id, offeredListingIds: [target.id] },
    ];

    for (const attempt of attempts) {
      await expect(proposeTrade(proposer.id, attempt)).rejects.toThrow();
    }
    expect(await prisma.tradeOffer.count()).toBe(0);
  });

  it("rejects a second pending offer for the same target and allows one after decline", async () => {
    const proposer = await createUser({ displayName: "Alex" });
    const receiver = await createUser({ displayName: "Jordan" });
    const category = await createCategory();
    const target = await addListing(receiver.id, category.id, "Target");
    const offered = await addListing(proposer.id, category.id, "Offered");
    const input = { targetListingId: target.id, offeredListingIds: [offered.id] };

    const first = await proposeTrade(proposer.id, input);
    await expect(proposeTrade(proposer.id, input)).rejects.toMatchObject({ code: "PENDING_EXISTS" });
    expect(await prisma.tradeOffer.count({ where: { status: "Pending" } })).toBe(1);

    await declineTrade(receiver.id, first.id);
    const again = await proposeTrade(proposer.id, input);
    expect(again.id).not.toBe(first.id);
    expect(await prisma.tradeOffer.count({ where: { status: "Pending" } })).toBe(1);
  });

  it("lets the same offered listing sit in two pending offers", async () => {
    const proposer = await createUser({ displayName: "Alex" });
    const firstReceiver = await createUser({ displayName: "Jordan" });
    const secondReceiver = await createUser({ displayName: "Sam" });
    const category = await createCategory();
    const offered = await addListing(proposer.id, category.id, "Shared");
    const t1 = await addListing(firstReceiver.id, category.id, "Target one");
    const t2 = await addListing(secondReceiver.id, category.id, "Target two");

    await proposeTrade(proposer.id, { targetListingId: t1.id, offeredListingIds: [offered.id] });
    await proposeTrade(proposer.id, { targetListingId: t2.id, offeredListingIds: [offered.id] });
    expect(await prisma.tradeOffer.count({ where: { status: "Pending" } })).toBe(2);
  });

  it("declines and cancels without a counter-offer or listing change", async () => {
    const proposer = await createUser({ displayName: "Alex" });
    const receiver = await createUser({ displayName: "Jordan" });
    const category = await createCategory();
    const target = await addListing(receiver.id, category.id, "Target");
    const offered = await addListing(proposer.id, category.id, "Offered");
    const input = { targetListingId: target.id, offeredListingIds: [offered.id] };

    const declined = await proposeTrade(proposer.id, input);
    await declineTrade(receiver.id, declined.id);
    expect(await prisma.tradeOffer.count()).toBe(1);
    expect(await prisma.tradeOffer.findUnique({ where: { id: declined.id } })).toMatchObject({
      status: "Declined",
      cancelledBy: null,
    });

    const cancelled = await proposeTrade(proposer.id, input);
    await cancelTrade(proposer.id, cancelled.id);
    expect(await prisma.tradeOffer.count()).toBe(2);
    expect(await prisma.tradeOffer.findUnique({ where: { id: cancelled.id } })).toMatchObject({
      status: "Cancelled",
      cancelledBy: "PROPOSER",
    });
    expect(await prisma.listing.findMany({ select: { status: true } })).toEqual([
      { status: "Available" },
      { status: "Available" },
    ]);
  });

  it("rejects the wrong actor and leaves the offer pending", async () => {
    const proposer = await createUser({ displayName: "Alex" });
    const receiver = await createUser({ displayName: "Jordan" });
    const stranger = await createUser({ displayName: "Sam" });
    const category = await createCategory();
    const target = await addListing(receiver.id, category.id, "Target");
    const offered = await addListing(proposer.id, category.id, "Offered");
    const created = await proposeTrade(proposer.id, {
      targetListingId: target.id,
      offeredListingIds: [offered.id],
    });

    await expect(acceptTrade(proposer.id, created.id)).rejects.toBeInstanceOf(DomainError);
    await expect(declineTrade(proposer.id, created.id)).rejects.toBeInstanceOf(DomainError);
    await expect(declineTrade(stranger.id, created.id)).rejects.toBeInstanceOf(DomainError);
    await expect(cancelTrade(receiver.id, created.id)).rejects.toBeInstanceOf(DomainError);
    await expect(cancelTrade(stranger.id, created.id)).rejects.toBeInstanceOf(DomainError);
    expect(await prisma.tradeOffer.findUnique({ where: { id: created.id } })).toMatchObject({
      status: "Pending",
    });
  });

  it("accepts in one transaction and cancels only conflicting pending offers", async () => {
    const proposer = await createUser({ displayName: "Alex" });
    const receiver = await createUser({ displayName: "Jordan" });
    const other = await createUser({ displayName: "Sam" });
    const outsider = await createUser({ displayName: "Riley" });
    const category = await createCategory();
    const target = await addListing(receiver.id, category.id, "T");
    const o1 = await addListing(proposer.id, category.id, "O1");
    const o2 = await addListing(proposer.id, category.id, "O2");
    const unrelatedTarget = await addListing(outsider.id, category.id, "U");
    const unrelatedOffered = await addListing(other.id, category.id, "V");
    const p2Offered = await addListing(other.id, category.id, "X");

    const acc = await proposeTrade(proposer.id, {
      targetListingId: target.id,
      offeredListingIds: [o1.id, o2.id],
    });
    const p2 = await prisma.tradeOffer.create({
      data: {
        proposerId: other.id,
        receiverId: receiver.id,
        targetListingId: target.id,
        status: "Pending",
        items: { create: [{ listingId: p2Offered.id }] },
      },
    });
    const p3 = await prisma.tradeOffer.create({
      data: {
        proposerId: other.id,
        receiverId: proposer.id,
        targetListingId: o2.id,
        status: "Pending",
        items: { create: [{ listingId: o1.id }] },
      },
    });
    const p4 = await prisma.tradeOffer.create({
      data: {
        proposerId: other.id,
        receiverId: outsider.id,
        targetListingId: unrelatedTarget.id,
        status: "Pending",
        items: { create: [{ listingId: unrelatedOffered.id }] },
      },
    });

    await acceptTrade(receiver.id, acc.id);

    expect(await prisma.tradeOffer.findUnique({ where: { id: acc.id } })).toMatchObject({
      status: "Accepted",
      cancelledBy: null,
    });
    expect(await prisma.tradeOffer.findUnique({ where: { id: p2.id } })).toMatchObject({
      status: "Cancelled",
      cancelledBy: "SYSTEM",
    });
    expect(await prisma.tradeOffer.findUnique({ where: { id: p3.id } })).toMatchObject({
      status: "Cancelled",
      cancelledBy: "SYSTEM",
    });
    expect(await prisma.tradeOffer.findUnique({ where: { id: p4.id } })).toMatchObject({
      status: "Pending",
      cancelledBy: null,
    });
    const statuses = await prisma.listing.findMany({
      where: { id: { in: [target.id, o1.id, o2.id] } },
      select: { id: true, status: true },
    });
    expect(statuses).toEqual(
      expect.arrayContaining([
        { id: target.id, status: "InTrade" },
        { id: o1.id, status: "InTrade" },
        { id: o2.id, status: "InTrade" },
      ]),
    );
  });

  it("does not accept or cancel conflicts when an involved listing is unavailable", async () => {
    const proposer = await createUser({ displayName: "Alex" });
    const receiver = await createUser({ displayName: "Jordan" });
    const other = await createUser({ displayName: "Sam" });
    const category = await createCategory();
    const target = await addListing(receiver.id, category.id, "T");
    const offered = await addListing(proposer.id, category.id, "O1");
    const otherOffered = await addListing(other.id, category.id, "X");
    const pending = await proposeTrade(proposer.id, {
      targetListingId: target.id,
      offeredListingIds: [offered.id],
    });
    const conflict = await prisma.tradeOffer.create({
      data: {
        proposerId: other.id,
        receiverId: receiver.id,
        targetListingId: target.id,
        status: "Pending",
        items: { create: [{ listingId: otherOffered.id }] },
      },
    });
    await prisma.listing.update({ where: { id: target.id }, data: { status: "InTrade" } });

    await expect(acceptTrade(receiver.id, pending.id)).rejects.toMatchObject({
      code: "LISTING_UNAVAILABLE",
    });
    expect(await prisma.tradeOffer.findUnique({ where: { id: pending.id } })).toMatchObject({
      status: "Pending",
    });
    expect(await prisma.tradeOffer.findUnique({ where: { id: conflict.id } })).toMatchObject({
      status: "Pending",
      cancelledBy: null,
    });
  });

  it("keeps declined and cancelled offers in both parties' history", async () => {
    const proposer = await createUser({ displayName: "Alex", city: "Portland" });
    const receiver = await createUser({ displayName: "Jordan", city: null });
    const category = await createCategory();
    const target = await addListing(receiver.id, category.id, "Target");
    const offered = await addListing(proposer.id, category.id, "Offered");
    const declined = await proposeTrade(proposer.id, {
      targetListingId: target.id,
      offeredListingIds: [offered.id],
    });
    await declineTrade(receiver.id, declined.id);
    const cancelled = await proposeTrade(proposer.id, {
      targetListingId: target.id,
      offeredListingIds: [offered.id],
    });
    await cancelTrade(proposer.id, cancelled.id);
    await prisma.tradeOffer.create({
      data: {
        proposerId: proposer.id,
        receiverId: receiver.id,
        targetListingId: target.id,
        status: "Cancelled",
        cancelledBy: "SYSTEM",
        items: { create: [{ listingId: offered.id }] },
      },
    });

    for (const userId of [proposer.id, receiver.id]) {
      const history = await listOfferHistory(userId);
      expect(history).toHaveLength(3);
      expect(history.map((offer) => offer.status).sort()).toEqual([
        "Cancelled",
        "Cancelled",
        "Declined",
      ]);
      expect(history.find((offer) => offer.cancelledBy === "SYSTEM")?.cancelLabel).toBe(
        "Cancelled because another trade was accepted",
      );
      expect(JSON.stringify(history)).not.toContain("@");
    }
  });
});
