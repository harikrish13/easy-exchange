import { DomainError } from "./errors";
import type { ListingStatusValue } from "./listings";
import type { OfferStatus } from "./offers";

export type CompletionListing = {
  id: string;
  status: ListingStatusValue;
};

export type CompletionOffer = {
  id: string;
  status: OfferStatus;
  proposerId: string;
  receiverId: string;
  targetListingId: string;
  offeredListingIds: string[];
  proposerReceivedAt: string | null;
  receiverReceivedAt: string | null;
};

function partyRole(offer: CompletionOffer, actorId: string): "proposer" | "receiver" | null {
  if (actorId === offer.proposerId) return "proposer";
  if (actorId === offer.receiverId) return "receiver";
  return null;
}

export function markReceived(input: {
  offer: CompletionOffer;
  actorId: string;
  now: string;
  listings: CompletionListing[];
}): { offer: CompletionOffer; listings: CompletionListing[] } {
  const role = partyRole(input.offer, input.actorId);
  if (!role) {
    throw new DomainError("WRONG_ACTOR", "Only the two people in this trade can mark it received.");
  }

  const already =
    role === "proposer" ? input.offer.proposerReceivedAt : input.offer.receiverReceivedAt;
  if (already) {
    return { offer: input.offer, listings: input.listings };
  }
  if (input.offer.status !== "Accepted") {
    throw new DomainError("NOT_ACCEPTED", "You can mark an item received only after the offer is accepted.");
  }

  const offer: CompletionOffer = {
    ...input.offer,
    proposerReceivedAt: role === "proposer" ? input.now : input.offer.proposerReceivedAt,
    receiverReceivedAt: role === "receiver" ? input.now : input.offer.receiverReceivedAt,
  };
  if (!offer.proposerReceivedAt || !offer.receiverReceivedAt) {
    return { offer, listings: input.listings };
  }

  const involved = new Set([offer.targetListingId, ...offer.offeredListingIds]);
  const byId = new Map(input.listings.map((item) => [item.id, item]));
  const listings = [...involved].map((id) => {
    const found = byId.get(id);
    if (!found) {
      throw new DomainError("LISTING_UNAVAILABLE", "An item in this trade could not be found.");
    }
    return { ...found, status: "Traded" as const };
  });

  return { offer: { ...offer, status: "Completed" }, listings };
}

export function rejectPostAcceptChange(status: OfferStatus): void {
  if (status === "Accepted" || status === "Completed") {
    throw new DomainError("NO_REOPEN", "This trade can't be cancelled or reopened.");
  }
}

export function createRating(input: {
  offerStatus: OfferStatus;
  proposerId: string;
  receiverId: string;
  actorId: string;
  score: number;
  comment: string | null;
  alreadyRated: boolean;
}): {
  raterUserId: string;
  ratedUserId: string;
  score: number;
  comment: string | null;
} {
  if (input.actorId !== input.proposerId && input.actorId !== input.receiverId) {
    throw new DomainError("WRONG_ACTOR", "Only the two people in this trade can leave a rating.");
  }
  if (input.offerStatus !== "Completed") {
    throw new DomainError("NOT_COMPLETED", "You can rate only after both people have marked the trade received.");
  }
  if (input.alreadyRated) {
    throw new DomainError("ALREADY_RATED", "You already rated this trade.");
  }
  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    throw new DomainError("INVALID_RATING", "Choose a rating from 1 to 5.");
  }

  const comment = input.comment?.trim() ?? "";
  if (comment.length > 500) {
    throw new DomainError("INVALID_RATING", "Comment must be 500 characters or fewer.");
  }
  const ratedUserId = input.actorId === input.proposerId ? input.receiverId : input.proposerId;
  if (ratedUserId === input.actorId) {
    throw new DomainError("INVALID_RATING", "You can't rate yourself.");
  }

  return {
    raterUserId: input.actorId,
    ratedUserId,
    score: input.score,
    comment: comment.length === 0 ? null : comment,
  };
}

export function rejectRatingChange(): never {
  throw new DomainError("RATING_IMMUTABLE", "A rating can't be changed after it's submitted.");
}

export function showRatingForm(status: OfferStatus, viewerHasRated: boolean): boolean {
  return status === "Completed" && !viewerHasRated;
}

export function showSubmittedRatings(status: OfferStatus): boolean {
  return status === "Completed";
}

export function showMarkReceived(status: OfferStatus, viewerHasMarked: boolean): boolean {
  return status === "Accepted" && !viewerHasMarked;
}
