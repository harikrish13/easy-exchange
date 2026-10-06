import {
  createRating,
  markReceived,
  showMarkReceived,
  showRatingForm,
  showSubmittedRatings,
  type CompletionOffer,
} from "@/domain/completion";
import { DomainError } from "@/domain/errors";
import { ratingSchema, tradeOfferIdSchema, type RatingInput } from "@/lib/offer-schema";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "./db";
import type { OfferItemView } from "./offers";

const detailInclude = {
  proposer: { select: { displayName: true, city: true } },
  receiver: { select: { displayName: true, city: true } },
  targetListing: {
    select: {
      id: true,
      title: true,
      photos: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { id: true } },
    },
  },
  items: {
    select: {
      listingId: true,
      listing: {
        select: {
          id: true,
          title: true,
          status: true,
          photos: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { id: true } },
        },
      },
    },
  },
  ratings: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      score: true,
      comment: true,
      raterUserId: true,
      rater: { select: { displayName: true } },
      rated: { select: { displayName: true } },
    },
  },
} as const;

type DetailRow = Prisma.TradeOfferGetPayload<{ include: typeof detailInclude }>;

function toCompletionOffer(offer: {
  id: string;
  status: CompletionOffer["status"];
  proposerId: string;
  receiverId: string;
  targetListingId: string;
  proposerReceivedAt: Date | null;
  receiverReceivedAt: Date | null;
  items: { listingId: string }[];
}): CompletionOffer {
  return {
    id: offer.id,
    status: offer.status,
    proposerId: offer.proposerId,
    receiverId: offer.receiverId,
    targetListingId: offer.targetListingId,
    offeredListingIds: offer.items.map((item) => item.listingId),
    proposerReceivedAt: offer.proposerReceivedAt?.toISOString() ?? null,
    receiverReceivedAt: offer.receiverReceivedAt?.toISOString() ?? null,
  };
}

function itemView(item: { id: string; title: string; photos: { id: string }[] }): OfferItemView {
  return { id: item.id, title: item.title, photoId: item.photos[0]?.id ?? null };
}

export type OfferDetail = {
  id: string;
  status: CompletionOffer["status"];
  statusLabel: string;
  counterpartName: string;
  counterpartCity: string | null;
  target: OfferItemView;
  offered: OfferItemView[];
  markReceivedVisible: boolean;
  youMarkedReceived: boolean;
  waitingOnOther: boolean;
  ratingFormVisible: boolean;
  ratingsVisible: boolean;
  ratings: {
    id: string;
    raterName: string;
    ratedName: string;
    score: number;
    comment: string | null;
  }[];
};

function toDetail(offer: DetailRow, viewerId: string): OfferDetail | null {
  if (offer.proposerId !== viewerId && offer.receiverId !== viewerId) return null;
  const viewerIsProposer = offer.proposerId === viewerId;
  const counterpart = viewerIsProposer ? offer.receiver : offer.proposer;
  const viewerMarked = viewerIsProposer ? offer.proposerReceivedAt : offer.receiverReceivedAt;
  const otherMarked = viewerIsProposer ? offer.receiverReceivedAt : offer.proposerReceivedAt;
  const viewerHasRated = offer.ratings.some((rating) => rating.raterUserId === viewerId);
  return {
    id: offer.id,
    status: offer.status,
    statusLabel: offer.status,
    counterpartName: counterpart.displayName,
    counterpartCity: counterpart.city,
    target: itemView(offer.targetListing),
    offered: offer.items.map((item) => itemView(item.listing)),
    markReceivedVisible: showMarkReceived(offer.status, viewerMarked !== null),
    youMarkedReceived: offer.status === "Accepted" && viewerMarked !== null,
    waitingOnOther: offer.status === "Accepted" && viewerMarked !== null && otherMarked === null,
    ratingFormVisible: showRatingForm(offer.status, viewerHasRated),
    ratingsVisible: showSubmittedRatings(offer.status),
    ratings: offer.ratings.map((rating) => ({
      id: rating.id,
      raterName: rating.rater.displayName,
      ratedName: rating.rated.displayName,
      score: rating.score,
      comment: rating.comment,
    })),
  };
}

export async function getOfferDetail(viewerId: string, tradeOfferId: string): Promise<OfferDetail | null> {
  const offer = await prisma.tradeOffer.findUnique({
    where: { id: tradeOfferId },
    include: detailInclude,
  });
  if (!offer) return null;
  return toDetail(offer, viewerId);
}

export async function markItemReceived(actorId: string, tradeOfferId: string): Promise<void> {
  const id = tradeOfferIdSchema.parse({ tradeOfferId }).tradeOfferId;
  await prisma.$transaction(async (tx) => {
    const offer = await tx.tradeOffer.findUnique({
      where: { id },
      include: { items: { select: { listingId: true } } },
    });
    if (!offer) throw new DomainError("NOT_FOUND", "That offer doesn't exist.");

    const state = toCompletionOffer(offer);
    const listingRows = await tx.listing.findMany({
      where: { id: { in: [state.targetListingId, ...state.offeredListingIds] } },
      select: { id: true, status: true },
    });
    const outcome = markReceived({
      offer: state,
      actorId,
      now: new Date().toISOString(),
      listings: listingRows,
    });

    const unchanged =
      outcome.offer.status === state.status &&
      outcome.offer.proposerReceivedAt === state.proposerReceivedAt &&
      outcome.offer.receiverReceivedAt === state.receiverReceivedAt;
    if (unchanged) return;

    await tx.tradeOffer.update({
      where: { id: offer.id },
      data: {
        status: outcome.offer.status,
        proposerReceivedAt: outcome.offer.proposerReceivedAt
          ? new Date(outcome.offer.proposerReceivedAt)
          : null,
        receiverReceivedAt: outcome.offer.receiverReceivedAt
          ? new Date(outcome.offer.receiverReceivedAt)
          : null,
      },
    });

    if (outcome.offer.status !== "Completed") return;
    const ids = outcome.listings.map((item) => item.id);
    const moved = await tx.listing.updateMany({
      where: { id: { in: ids } },
      data: { status: "Traded" },
    });
    if (moved.count !== ids.length) {
      throw new DomainError("LISTING_UNAVAILABLE", "An item in this trade could not be found.");
    }
  });
}

export async function leaveRating(actorId: string, input: RatingInput): Promise<void> {
  const parsed = ratingSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const offer = await tx.tradeOffer.findUnique({
      where: { id: parsed.tradeOfferId },
      include: { ratings: { where: { raterUserId: actorId }, select: { id: true } } },
    });
    if (!offer) throw new DomainError("NOT_FOUND", "That offer doesn't exist.");

    const rating = createRating({
      offerStatus: offer.status,
      proposerId: offer.proposerId,
      receiverId: offer.receiverId,
      actorId,
      score: parsed.score,
      comment: parsed.comment,
      alreadyRated: offer.ratings.length > 0,
    });

    try {
      await tx.rating.create({
        data: {
          tradeOfferId: offer.id,
          raterUserId: rating.raterUserId,
          ratedUserId: rating.ratedUserId,
          score: rating.score,
          comment: rating.comment,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new DomainError("ALREADY_RATED", "You already rated this trade.");
      }
      throw error;
    }
  });
}
