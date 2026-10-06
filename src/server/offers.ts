import { DomainError } from "@/domain/errors";
import {
  acceptOffer,
  assertCanPropose,
  cancelOfferByProposer,
  declineOffer,
  pendingOfferFields,
  type OfferListing,
  type TradeOfferState,
} from "@/domain/offers";
import { proposeSchema, tradeOfferIdSchema, type ProposeInput } from "@/lib/offer-schema";
import { prisma } from "./db";

type OfferRow = {
  id: string;
  proposerId: string;
  receiverId: string;
  targetListingId: string;
  status: TradeOfferState["status"];
  cancelledBy: TradeOfferState["cancelledBy"];
  items: { listingId: string }[];
};

function toState(offer: OfferRow): TradeOfferState {
  return {
    id: offer.id,
    proposerId: offer.proposerId,
    receiverId: offer.receiverId,
    targetListingId: offer.targetListingId,
    offeredListingIds: offer.items.map((item) => item.listingId),
    status: offer.status,
    cancelledBy: offer.cancelledBy,
  };
}

function toListing(row: { id: string; ownerId: string; status: OfferListing["status"] }): OfferListing {
  return { id: row.id, ownerId: row.ownerId, status: row.status };
}

export async function proposeTrade(proposerId: string, input: ProposeInput): Promise<{ id: string }> {
  const parsed = proposeSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const target = await tx.listing.findUnique({ where: { id: parsed.targetListingId } });
    if (!target) {
      throw new DomainError("TARGET_UNAVAILABLE", "That item is not available.");
    }

    const rows = await tx.listing.findMany({
      where: { id: { in: parsed.offeredListingIds } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const offered = parsed.offeredListingIds.map((id) => {
      const row = byId.get(id);
      if (!row) {
        throw new DomainError("INVALID_OFFERED", "Choose 1 to 3 of your available items.");
      }
      return toListing(row);
    });

    const pending = await tx.tradeOffer.findFirst({
      where: {
        proposerId,
        targetListingId: target.id,
        status: "Pending",
      },
      select: { id: true },
    });
    const proposeInput = {
      proposerId,
      target: toListing(target),
      offered,
      pendingExists: pending !== null,
    };
    assertCanPropose(proposeInput);
    const fields = pendingOfferFields(proposeInput);

    const created = await tx.tradeOffer.create({
      data: {
        proposerId: fields.proposerId,
        receiverId: fields.receiverId,
        targetListingId: fields.targetListingId,
        status: "Pending",
        cancelledBy: null,
        items: {
          create: fields.offeredListingIds.map((listingId) => ({ listingId })),
        },
      },
      select: { id: true },
    });
    return created;
  });
}

export async function declineTrade(actorId: string, tradeOfferId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const offer = await tx.tradeOffer.findUnique({
      where: { id: tradeOfferIdSchema.parse({ tradeOfferId }).tradeOfferId },
      include: { items: { select: { listingId: true } } },
    });
    if (!offer) throw new DomainError("NOT_FOUND", "That offer doesn't exist.");
    const next = declineOffer(toState(offer), actorId);
    await tx.tradeOffer.update({
      where: { id: offer.id },
      data: { status: next.status, cancelledBy: next.cancelledBy },
    });
  });
}

export async function cancelTrade(actorId: string, tradeOfferId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const offer = await tx.tradeOffer.findUnique({
      where: { id: tradeOfferIdSchema.parse({ tradeOfferId }).tradeOfferId },
      include: { items: { select: { listingId: true } } },
    });
    if (!offer) throw new DomainError("NOT_FOUND", "That offer doesn't exist.");
    const next = cancelOfferByProposer(toState(offer), actorId);
    await tx.tradeOffer.update({
      where: { id: offer.id },
      data: { status: next.status, cancelledBy: next.cancelledBy },
    });
  });
}

export async function acceptTrade(actorId: string, tradeOfferId: string): Promise<void> {
  const id = tradeOfferIdSchema.parse({ tradeOfferId }).tradeOfferId;
  await prisma.$transaction(async (tx) => {
    const offer = await tx.tradeOffer.findUnique({
      where: { id },
      include: { items: { select: { listingId: true } } },
    });
    if (!offer) throw new DomainError("NOT_FOUND", "That offer doesn't exist.");

    const state = toState(offer);
    const involvedIds = [state.targetListingId, ...state.offeredListingIds];
    const listingRows = await tx.listing.findMany({ where: { id: { in: involvedIds } } });
    const others = await tx.tradeOffer.findMany({
      where: {
        id: { not: offer.id },
        status: "Pending",
        OR: [
          { targetListingId: { in: involvedIds } },
          { items: { some: { listingId: { in: involvedIds } } } },
        ],
      },
      include: { items: { select: { listingId: true } } },
    });

    const outcome = acceptOffer({
      offer: state,
      actorId,
      involvedListings: listingRows.map(toListing),
      otherOffers: others.map(toState),
    });

    await tx.tradeOffer.update({
      where: { id: offer.id },
      data: { status: "Accepted", cancelledBy: null },
    });
    const moved = await tx.listing.updateMany({
      where: { id: { in: outcome.listings.map((item) => item.id) }, status: "Available" },
      data: { status: "InTrade" },
    });
    if (moved.count !== outcome.listings.length) {
      throw new DomainError(
        "LISTING_UNAVAILABLE",
        "Every item in this offer must still be available.",
      );
    }
    for (const cancelled of outcome.otherOffers) {
      if (cancelled.status !== "Cancelled") continue;
      await tx.tradeOffer.update({
        where: { id: cancelled.id },
        data: { status: "Cancelled", cancelledBy: "SYSTEM" },
      });
    }
  });
}

export type OfferItemView = {
  id: string;
  title: string;
  photoId: string | null;
};

export type OfferView = {
  id: string;
  status: TradeOfferState["status"];
  statusLabel: string;
  cancelledBy: TradeOfferState["cancelledBy"];
  cancelLabel: string | null;
  counterpartName: string;
  counterpartCity: string | null;
  target: OfferItemView;
  offered: OfferItemView[];
  canAccept: boolean;
  canDecline: boolean;
  canCancel: boolean;
  madeByViewer: boolean;
};

const historyInclude = {
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
      listing: {
        select: {
          id: true,
          title: true,
          photos: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { id: true } },
        },
      },
    },
  },
} as const;

function statusLabel(status: TradeOfferState["status"]): string {
  return status;
}

function cancelLabel(cancelledBy: TradeOfferState["cancelledBy"]): string | null {
  if (cancelledBy === "SYSTEM") return "Cancelled because another trade was accepted";
  if (cancelledBy === "PROPOSER") return "Cancelled by the person who made the offer";
  return null;
}

function toView(
  offer: {
    id: string;
    status: TradeOfferState["status"];
    cancelledBy: TradeOfferState["cancelledBy"];
    proposerId: string;
    receiverId: string;
    proposer: { displayName: string; city: string | null };
    receiver: { displayName: string; city: string | null };
    targetListing: { id: string; title: string; photos: { id: string }[] };
    items: { listing: { id: string; title: string; photos: { id: string }[] } }[];
  },
  viewerId: string,
): OfferView {
  const viewerIsReceiver = offer.receiverId === viewerId;
  const counterpart = viewerIsReceiver ? offer.proposer : offer.receiver;
  const pending = offer.status === "Pending";
  return {
    id: offer.id,
    status: offer.status,
    statusLabel: statusLabel(offer.status),
    cancelledBy: offer.cancelledBy,
    cancelLabel: offer.status === "Cancelled" ? cancelLabel(offer.cancelledBy) : null,
    counterpartName: counterpart.displayName,
    counterpartCity: counterpart.city,
    target: {
      id: offer.targetListing.id,
      title: offer.targetListing.title,
      photoId: offer.targetListing.photos[0]?.id ?? null,
    },
    offered: offer.items.map((item) => ({
      id: item.listing.id,
      title: item.listing.title,
      photoId: item.listing.photos[0]?.id ?? null,
    })),
    canAccept: pending && viewerIsReceiver,
    canDecline: pending && viewerIsReceiver,
    canCancel: pending && offer.proposerId === viewerId,
    madeByViewer: offer.proposerId === viewerId,
  };
}

export async function listIncoming(userId: string): Promise<OfferView[]> {
  const offers = await prisma.tradeOffer.findMany({
    where: { receiverId: userId },
    orderBy: { createdAt: "desc" },
    include: historyInclude,
  });
  return offers.map((offer) => toView(offer, userId));
}

export async function listOfferHistory(userId: string): Promise<OfferView[]> {
  const offers = await prisma.tradeOffer.findMany({
    where: { OR: [{ proposerId: userId }, { receiverId: userId }] },
    orderBy: { createdAt: "desc" },
    include: historyInclude,
  });
  return offers.map((offer) => toView(offer, userId));
}

export async function listAvailableToOffer(ownerId: string) {
  return prisma.listing.findMany({
    where: { ownerId, status: "Available" },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
}
