import {
  conditionLabel,
  formatFairnessHint,
  statusLabel,
} from "@/domain/listings";
import { prisma } from "./db";

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function listCatalog(input: {
  viewerId: string | null;
  category: string | null;
}) {
  let categoryId: string | undefined;
  if (input.category) {
    const category = await prisma.category.findFirst({
      where: { OR: [{ slug: input.category }, { id: input.category }] },
      select: { id: true },
    });
    if (!category) return [];
    categoryId = category.id;
  }

  const listings = await prisma.listing.findMany({
    where: {
      status: "Available",
      ...(input.viewerId ? { ownerId: { not: input.viewerId } } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      condition: true,
      createdAt: true,
      category: { select: { name: true } },
      photos: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  return listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    categoryName: listing.category.name,
    conditionLabel: conditionLabel(listing.condition),
    photoId: listing.photos[0]?.id ?? null,
    createdAt: listing.createdAt,
  }));
}

export async function getListingDetail(id: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      title: true,
      description: true,
      condition: true,
      conditionNotes: true,
      estimatedValueCents: true,
      lookingFor: true,
      status: true,
      category: { select: { name: true } },
      photos: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, sortOrder: true },
      },
      owner: { select: { displayName: true, city: true } },
    },
  });
  if (!listing) return null;

  return {
    id: listing.id,
    ownerId: listing.ownerId,
    title: listing.title,
    description: listing.description,
    conditionLabel: conditionLabel(listing.condition),
    conditionNotes: listing.conditionNotes,
    fairnessHint:
      listing.estimatedValueCents == null
        ? null
        : formatFairnessHint(listing.estimatedValueCents),
    lookingFor: listing.lookingFor,
    status: listing.status,
    statusLabel: statusLabel(listing.status),
    categoryName: listing.category.name,
    photos: listing.photos,
    ownerDisplayName: listing.owner.displayName,
    ownerCity: listing.owner.city,
  };
}
