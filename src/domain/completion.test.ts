import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import {
  createRating,
  markReceived,
  rejectPostAcceptChange,
  rejectRatingChange,
  showMarkReceived,
  showRatingForm,
  showSubmittedRatings,
  type CompletionOffer,
  type CompletionListing,
} from "./completion";

const now = "2026-10-06T18:00:00.000Z";
const earlier = "2026-10-06T17:00:00.000Z";

function accepted(overrides: Partial<CompletionOffer> = {}): CompletionOffer {
  return {
    id: "offer_1",
    status: "Accepted",
    proposerId: "user_a",
    receiverId: "user_b",
    targetListingId: "T",
    offeredListingIds: ["O1", "O2"],
    proposerReceivedAt: null,
    receiverReceivedAt: null,
    ...overrides,
  };
}

const listings: CompletionListing[] = [
  { id: "T", status: "InTrade" },
  { id: "O1", status: "InTrade" },
  { id: "O2", status: "InTrade" },
];

describe("mark received", () => {
  it("sets only the proposer's timestamp and leaves the trade accepted", () => {
    const result = markReceived({
      offer: accepted(),
      actorId: "user_a",
      now,
      listings,
    });

    expect(result.offer).toMatchObject({
      status: "Accepted",
      proposerReceivedAt: now,
      receiverReceivedAt: null,
    });
    expect(result.listings.map((item) => item.status)).toEqual(["InTrade", "InTrade", "InTrade"]);
  });

  it("completes the trade when the second party marks received", () => {
    const result = markReceived({
      offer: accepted({ proposerReceivedAt: earlier }),
      actorId: "user_b",
      now,
      listings,
    });

    expect(result.offer).toMatchObject({
      status: "Completed",
      proposerReceivedAt: earlier,
      receiverReceivedAt: now,
    });
    expect(result.listings).toEqual([
      { id: "T", status: "Traded" },
      { id: "O1", status: "Traded" },
      { id: "O2", status: "Traded" },
    ]);
    expect(result.listings).toHaveLength(3);
  });

  it("is a success when that party already marked received", () => {
    const offer = accepted({
      proposerReceivedAt: earlier,
      receiverReceivedAt: null,
    });
    const result = markReceived({ offer, actorId: "user_a", now, listings });
    expect(result.offer).toEqual(offer);
    expect(result.listings).toEqual(listings);

    const completed = accepted({
      status: "Completed",
      proposerReceivedAt: earlier,
      receiverReceivedAt: earlier,
    });
    const traded = listings.map((item) => ({ ...item, status: "Traded" as const }));
    const again = markReceived({
      offer: completed,
      actorId: "user_b",
      now,
      listings: traded,
    });
    expect(again.offer).toEqual(completed);
    expect(again.listings).toEqual(traded);
  });

  it("rejects a stranger and a non-accepted offer", () => {
    expect(() =>
      markReceived({ offer: accepted(), actorId: "stranger", now, listings }),
    ).toThrow(DomainError);
    expect(() =>
      markReceived({
        offer: accepted({ status: "Pending" }),
        actorId: "user_a",
        now,
        listings,
      }),
    ).toThrow(DomainError);
    try {
      markReceived({ offer: accepted(), actorId: "stranger", now, listings });
    } catch (error) {
      expect(error).toMatchObject({ code: "WRONG_ACTOR" });
    }
  });

  it("rejects cancel, dispute, or reopen after accept", () => {
    expect(() => rejectPostAcceptChange("Accepted")).toThrow(DomainError);
    expect(() => rejectPostAcceptChange("Completed")).toThrow(DomainError);
    try {
      rejectPostAcceptChange("Accepted");
    } catch (error) {
      expect(error).toMatchObject({ code: "NO_REOPEN" });
    }
  });
});

describe("ratings", () => {
  it("rejects a rating before the trade is completed", () => {
    for (const status of ["Pending", "Accepted", "Declined", "Cancelled"] as const) {
      expect(() =>
        createRating({
          offerStatus: status,
          proposerId: "user_a",
          receiverId: "user_b",
          actorId: "user_a",
          score: 5,
          comment: "",
          alreadyRated: false,
        }),
      ).toThrow(DomainError);
    }
  });

  it("creates one rating for the other party and rejects a second", () => {
    const created = createRating({
      offerStatus: "Completed",
      proposerId: "user_a",
      receiverId: "user_b",
      actorId: "user_a",
      score: 4,
      comment: "  Fair swap.  ",
      alreadyRated: false,
    });
    expect(created).toEqual({
      raterUserId: "user_a",
      ratedUserId: "user_b",
      score: 4,
      comment: "Fair swap.",
    });

    expect(
      createRating({
        offerStatus: "Completed",
        proposerId: "user_a",
        receiverId: "user_b",
        actorId: "user_b",
        score: 1,
        comment: "",
        alreadyRated: false,
      }).ratedUserId,
    ).toBe("user_a");

    expect(() =>
      createRating({
        offerStatus: "Completed",
        proposerId: "user_a",
        receiverId: "user_b",
        actorId: "user_a",
        score: 3,
        comment: null,
        alreadyRated: true,
      }),
    ).toThrow(DomainError);

    expect(() =>
      createRating({
        offerStatus: "Completed",
        proposerId: "user_a",
        receiverId: "user_b",
        actorId: "user_a",
        score: 0,
        comment: null,
        alreadyRated: false,
      }),
    ).toThrow(DomainError);
  });

  it("rejects a comment longer than 500 characters and a stranger", () => {
    expect(() =>
      createRating({
        offerStatus: "Completed",
        proposerId: "user_a",
        receiverId: "user_b",
        actorId: "user_a",
        score: 5,
        comment: "a".repeat(501),
        alreadyRated: false,
      }),
    ).toThrow(DomainError);

    expect(() =>
      createRating({
        offerStatus: "Completed",
        proposerId: "user_a",
        receiverId: "user_b",
        actorId: "stranger",
        score: 5,
        comment: null,
        alreadyRated: false,
      }),
    ).toThrow(DomainError);

    expect(
      createRating({
        offerStatus: "Completed",
        proposerId: "user_a",
        receiverId: "user_b",
        actorId: "user_b",
        score: 5,
        comment: "a".repeat(500),
        alreadyRated: false,
      }).comment,
    ).toHaveLength(500);
  });

  it("rejects editing or deleting a submitted rating", () => {
    expect(() => rejectRatingChange()).toThrow(DomainError);
    try {
      rejectRatingChange();
    } catch (error) {
      expect(error).toMatchObject({ code: "RATING_IMMUTABLE" });
    }
  });

  it("shows the rating form only after completion, and hides it after a party has rated", () => {
    for (const status of ["Pending", "Accepted", "Declined", "Cancelled"] as const) {
      expect(showRatingForm(status, false)).toBe(false);
      expect(showSubmittedRatings(status)).toBe(false);
    }
    expect(showRatingForm("Completed", false)).toBe(true);
    expect(showRatingForm("Completed", true)).toBe(false);
    expect(showSubmittedRatings("Completed")).toBe(true);
    expect(showMarkReceived("Accepted", false)).toBe(true);
    expect(showMarkReceived("Accepted", true)).toBe(false);
    expect(showMarkReceived("Completed", false)).toBe(false);
  });
});
