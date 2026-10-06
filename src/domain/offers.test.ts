import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import {
  acceptOffer,
  assertCanPropose,
  cancelOfferByProposer,
  declineOffer,
  pendingOfferFields,
  type OfferListing,
  type TradeOfferState,
} from "./offers";

function listing(
  id: string,
  ownerId: string,
  status: OfferListing["status"] = "Available",
): OfferListing {
  return { id, ownerId, status };
}

function offer(input: {
  id: string;
  proposerId: string;
  receiverId: string;
  targetListingId: string;
  offeredListingIds: string[];
  status?: TradeOfferState["status"];
  cancelledBy?: TradeOfferState["cancelledBy"];
}): TradeOfferState {
  return {
    id: input.id,
    proposerId: input.proposerId,
    receiverId: input.receiverId,
    targetListingId: input.targetListingId,
    offeredListingIds: input.offeredListingIds,
    status: input.status ?? "Pending",
    cancelledBy: input.cancelledBy ?? null,
  };
}

const target = listing("T", "owner_b");
const offered = [listing("O1", "user_a"), listing("O2", "user_a")];

describe("propose", () => {
  it("rejects an offer on the proposer's own listing", () => {
    expect(() =>
      assertCanPropose({
        proposerId: "owner_b",
        target,
        offered: [listing("O1", "owner_b")],
        pendingExists: false,
      }),
    ).toThrow(DomainError);
    try {
      assertCanPropose({
        proposerId: "owner_b",
        target,
        offered: [listing("O1", "owner_b")],
        pendingExists: false,
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "OWN_LISTING" });
    }
  });

  it("builds a pending offer for someone else's available listing", () => {
    expect(() =>
      assertCanPropose({
        proposerId: "user_a",
        target,
        offered,
        pendingExists: false,
      }),
    ).not.toThrow();

    expect(
      pendingOfferFields({
        proposerId: "user_a",
        target,
        offered,
      }),
    ).toEqual({
      proposerId: "user_a",
      receiverId: "owner_b",
      targetListingId: "T",
      offeredListingIds: ["O1", "O2"],
      status: "Pending",
      cancelledBy: null,
    });
  });

  it("rejects offered listings that are not a valid 1 to 3 set", () => {
    const cases = [
      { offered: [] as OfferListing[] },
      {
        offered: [
          listing("O1", "user_a"),
          listing("O2", "user_a"),
          listing("O3", "user_a"),
          listing("O4", "user_a"),
        ],
      },
      { offered: [listing("O1", "someone_else")] },
      { offered: [listing("O1", "user_a", "InTrade")] },
      { offered: [listing("O1", "user_a"), listing("O1", "user_a")] },
      { offered: [listing("T", "user_a")] },
    ];

    for (const extra of cases) {
      expect(() =>
        assertCanPropose({
          proposerId: "user_a",
          target,
          offered: extra.offered,
          pendingExists: false,
        }),
      ).toThrow(DomainError);
    }
  });

  it("rejects a second pending offer for the same proposer and target", () => {
    expect(() =>
      assertCanPropose({
        proposerId: "user_a",
        target,
        offered,
        pendingExists: true,
      }),
    ).toThrow(DomainError);
    try {
      assertCanPropose({
        proposerId: "user_a",
        target,
        offered,
        pendingExists: true,
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "PENDING_EXISTS" });
    }
  });

  it("allows another propose when no pending offer remains for that pair", () => {
    expect(() =>
      assertCanPropose({
        proposerId: "user_a",
        target,
        offered: [listing("O1", "user_a")],
        pendingExists: false,
      }),
    ).not.toThrow();
  });

  it("allows the same offered listing on two different targets", () => {
    const shared = [listing("O1", "user_a")];
    expect(() =>
      assertCanPropose({
        proposerId: "user_a",
        target: listing("T1", "owner_b"),
        offered: shared,
        pendingExists: false,
      }),
    ).not.toThrow();
    expect(() =>
      assertCanPropose({
        proposerId: "user_a",
        target: listing("T2", "owner_c"),
        offered: shared,
        pendingExists: false,
      }),
    ).not.toThrow();
  });

  it("rejects a target that is missing availability", () => {
    expect(() =>
      assertCanPropose({
        proposerId: "user_a",
        target: listing("T", "owner_b", "InTrade"),
        offered: [listing("O1", "user_a")],
        pendingExists: false,
      }),
    ).toThrow(DomainError);
  });
});

describe("decline and cancel", () => {
  const pending = offer({
    id: "offer_1",
    proposerId: "user_a",
    receiverId: "owner_b",
    targetListingId: "T",
    offeredListingIds: ["O1"],
  });

  it("lets the receiver decline without touching listings or creating another offer", () => {
    const declined = declineOffer(pending, "owner_b");
    expect(declined).toEqual({
      ...pending,
      status: "Declined",
      cancelledBy: null,
    });
    expect(declined.id).toBe(pending.id);
  });

  it("lets the proposer cancel and records proposer as the reason", () => {
    const cancelled = cancelOfferByProposer(pending, "user_a");
    expect(cancelled).toEqual({
      ...pending,
      status: "Cancelled",
      cancelledBy: "PROPOSER",
    });
    expect(cancelled.id).toBe(pending.id);
  });

  it("rejects the wrong actor and leaves the offer pending", () => {
    expect(() => declineOffer(pending, "user_a")).toThrow(DomainError);
    expect(() => declineOffer(pending, "stranger")).toThrow(DomainError);
    expect(() => cancelOfferByProposer(pending, "owner_b")).toThrow(DomainError);
    expect(() => cancelOfferByProposer(pending, "stranger")).toThrow(DomainError);
    expect(pending.status).toBe("Pending");
    try {
      declineOffer(pending, "user_a");
    } catch (error) {
      expect(error).toMatchObject({ code: "WRONG_ACTOR" });
    }
  });

  it("rejects decline or cancel once the offer is no longer pending", () => {
    const accepted = { ...pending, status: "Accepted" as const };
    expect(() => declineOffer(accepted, "owner_b")).toThrow(DomainError);
    expect(() => cancelOfferByProposer(accepted, "user_a")).toThrow(DomainError);
  });
});

describe("accept", () => {
  const acc = offer({
    id: "acc",
    proposerId: "user_a",
    receiverId: "owner_b",
    targetListingId: "T",
    offeredListingIds: ["O1", "O2"],
  });
  const involved = [target, listing("O1", "user_a"), listing("O2", "user_a")];

  it("moves the offer to Accepted and the involved listings to InTrade", () => {
    const result = acceptOffer({
      offer: acc,
      actorId: "owner_b",
      involvedListings: involved,
      otherOffers: [],
    });

    expect(result.offer).toEqual({ ...acc, status: "Accepted", cancelledBy: null });
    expect(result.listings.map((item) => [item.id, item.status])).toEqual([
      ["T", "InTrade"],
      ["O1", "InTrade"],
      ["O2", "InTrade"],
    ]);
  });

  it("cancels conflicting pending offers and leaves an unrelated offer pending", () => {
    const p2 = offer({
      id: "p2",
      proposerId: "user_c",
      receiverId: "owner_b",
      targetListingId: "T",
      offeredListingIds: ["X1"],
    });
    const p3 = offer({
      id: "p3",
      proposerId: "user_d",
      receiverId: "user_a",
      targetListingId: "OTHER",
      offeredListingIds: ["O1", "Y1"],
    });
    const p4 = offer({
      id: "p4",
      proposerId: "user_e",
      receiverId: "user_f",
      targetListingId: "U",
      offeredListingIds: ["V"],
    });

    const result = acceptOffer({
      offer: acc,
      actorId: "owner_b",
      involvedListings: involved,
      otherOffers: [p2, p3, p4],
    });

    expect(result.offer).toMatchObject({
      id: "acc",
      status: "Accepted",
      cancelledBy: null,
    });
    expect(result.otherOffers).toEqual([
      { ...p2, status: "Cancelled", cancelledBy: "SYSTEM" },
      { ...p3, status: "Cancelled", cancelledBy: "SYSTEM" },
      { ...p4, status: "Pending", cancelledBy: null },
    ]);
    expect(result.otherOffers.find((item) => item.id === "acc")).toBeUndefined();
  });

  it("rejects accept when an involved listing is not Available and cancels nothing", () => {
    const p2 = offer({
      id: "p2",
      proposerId: "user_c",
      receiverId: "owner_b",
      targetListingId: "T",
      offeredListingIds: ["X1"],
    });
    const snapshot = structuredClone(p2);

    expect(() =>
      acceptOffer({
        offer: acc,
        actorId: "owner_b",
        involvedListings: [listing("T", "owner_b", "InTrade"), listing("O1", "user_a")],
        otherOffers: [p2],
      }),
    ).toThrow(DomainError);
    expect(p2).toEqual(snapshot);
    expect(acc.status).toBe("Pending");
  });

  it("rejects accept from the proposer or a stranger", () => {
    expect(() =>
      acceptOffer({
        offer: acc,
        actorId: "user_a",
        involvedListings: involved,
        otherOffers: [],
      }),
    ).toThrow(DomainError);
    expect(() =>
      acceptOffer({
        offer: acc,
        actorId: "stranger",
        involvedListings: involved,
        otherOffers: [],
      }),
    ).toThrow(DomainError);
    expect(acc.status).toBe("Pending");
  });
});

describe("domain boundary", () => {
  it("keeps trade-offer transitions free of Next.js, Auth.js, and Prisma", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "domain", "offers.ts"), "utf8");
    expect(source).not.toMatch(/from ["']next/);
    expect(source).not.toMatch(/next-auth/);
    expect(source).not.toMatch(/@prisma\/client/);
  });
});
