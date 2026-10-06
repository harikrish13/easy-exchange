import { DomainError } from "./errors";
import type { ListingStatusValue } from "./listings";

export type OfferListing = {
  id: string;
  ownerId: string;
  status: ListingStatusValue;
};

export type OfferStatus = "Pending" | "Accepted" | "Declined" | "Cancelled" | "Completed";

export type CancelledByValue = "PROPOSER" | "SYSTEM";

export type TradeOfferState = {
  id: string;
  proposerId: string;
  receiverId: string;
  targetListingId: string;
  offeredListingIds: string[];
  status: OfferStatus;
  cancelledBy: CancelledByValue | null;
};

function assertOfferedSet(
  proposerId: string,
  target: OfferListing,
  offered: OfferListing[],
): void {
  if (offered.length < 1 || offered.length > 3) {
    throw new DomainError("INVALID_OFFERED", "Choose 1 to 3 of your available items.");
  }

  const seen = new Set<string>();
  for (const item of offered) {
    if (seen.has(item.id) || item.id === target.id) {
      throw new DomainError(
        "INVALID_OFFERED",
        "Each offered item must be one of your own items, and not the item you are asking for.",
      );
    }
    seen.add(item.id);
    if (item.ownerId !== proposerId || item.status !== "Available") {
      throw new DomainError("INVALID_OFFERED", "Choose 1 to 3 of your available items.");
    }
  }
}

export function assertCanPropose(input: {
  proposerId: string;
  target: OfferListing;
  offered: OfferListing[];
  pendingExists: boolean;
}): void {
  if (input.target.ownerId === input.proposerId) {
    throw new DomainError("OWN_LISTING", "No offers on your own listing.");
  }
  if (input.target.status !== "Available") {
    throw new DomainError("TARGET_UNAVAILABLE", "That item is not available.");
  }
  assertOfferedSet(input.proposerId, input.target, input.offered);
  if (input.pendingExists) {
    throw new DomainError("PENDING_EXISTS", "You already have a pending offer for this item.");
  }
}

export function pendingOfferFields(input: {
  proposerId: string;
  target: OfferListing;
  offered: OfferListing[];
}): {
  proposerId: string;
  receiverId: string;
  targetListingId: string;
  offeredListingIds: string[];
  status: "Pending";
  cancelledBy: null;
} {
  assertCanPropose({ ...input, pendingExists: false });
  return {
    proposerId: input.proposerId,
    receiverId: input.target.ownerId,
    targetListingId: input.target.id,
    offeredListingIds: input.offered.map((item) => item.id),
    status: "Pending",
    cancelledBy: null,
  };
}

function assertPending(offer: TradeOfferState): void {
  if (offer.status !== "Pending") {
    throw new DomainError("NOT_PENDING", "That offer is no longer pending.");
  }
}

export function declineOffer(offer: TradeOfferState, actorId: string): TradeOfferState {
  assertPending(offer);
  if (actorId !== offer.receiverId) {
    throw new DomainError("WRONG_ACTOR", "Only the person who received this offer can decline it.");
  }
  return { ...offer, status: "Declined", cancelledBy: null };
}

export function cancelOfferByProposer(offer: TradeOfferState, actorId: string): TradeOfferState {
  assertPending(offer);
  if (actorId !== offer.proposerId) {
    throw new DomainError("WRONG_ACTOR", "Only the person who made this offer can cancel it.");
  }
  return { ...offer, status: "Cancelled", cancelledBy: "PROPOSER" };
}

export function acceptOffer(input: {
  offer: TradeOfferState;
  actorId: string;
  involvedListings: OfferListing[];
  otherOffers: TradeOfferState[];
}): {
  offer: TradeOfferState;
  listings: OfferListing[];
  otherOffers: TradeOfferState[];
} {
  assertPending(input.offer);
  if (input.actorId !== input.offer.receiverId) {
    throw new DomainError("WRONG_ACTOR", "Only the person who received this offer can accept it.");
  }

  const involvedIds = [input.offer.targetListingId, ...input.offer.offeredListingIds];
  const byId = new Map(input.involvedListings.map((item) => [item.id, item]));
  const listings = involvedIds.map((id) => {
    const found = byId.get(id);
    if (!found || found.status !== "Available") {
      throw new DomainError(
        "LISTING_UNAVAILABLE",
        "Every item in this offer must still be available.",
      );
    }
    return { ...found, status: "InTrade" as const };
  });

  const involved = new Set(involvedIds);
  const otherOffers = input.otherOffers.map((other) => {
    if (other.id === input.offer.id || other.status !== "Pending") return { ...other };
    const touches =
      involved.has(other.targetListingId) ||
      other.offeredListingIds.some((id) => involved.has(id));
    if (!touches) return { ...other };
    return { ...other, status: "Cancelled" as const, cancelledBy: "SYSTEM" as const };
  });

  return {
    offer: { ...input.offer, status: "Accepted", cancelledBy: null },
    listings,
    otherOffers,
  };
}
