import { DomainError } from "./errors";

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const CONDITIONS = ["Mint", "NearMint", "Excellent", "Good", "Fair"] as const;

export type ConditionValue = (typeof CONDITIONS)[number];
export type ListingStatusValue = "Available" | "InTrade" | "Traded";

const CONDITION_LABELS: Record<ConditionValue, string> = {
  Mint: "Mint",
  NearMint: "Near Mint",
  Excellent: "Excellent",
  Good: "Good",
  Fair: "Fair",
};

export type PhotoCandidate = {
  mimeType: string;
  sizeBytes: number;
  header: Uint8Array;
};

export type ListingFieldInput = {
  title: string;
  categoryId: string;
  condition: string;
  description: string;
  conditionNotes?: string | null;
  estimatedValue?: string | null;
  lookingFor?: string | null;
};

export type ListingFields = {
  title: string;
  categoryId: string;
  condition: ConditionValue;
  description: string;
  conditionNotes: string | null;
  estimatedValueCents: number | null;
  lookingFor: string | null;
};

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function headerMatches(header: Uint8Array, magic: number[]): boolean {
  if (header.length < magic.length) return false;
  return magic.every((byte, index) => header[index] === byte);
}

export function parseEstimatedValue(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new DomainError(
      "INVALID_ESTIMATED_VALUE",
      "Enter a dollar amount with at most 2 decimal places, or leave it blank.",
    );
  }

  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > 2) {
    throw new DomainError(
      "INVALID_ESTIMATED_VALUE",
      "Enter a dollar amount with at most 2 decimal places, or leave it blank.",
    );
  }

  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) {
    throw new DomainError(
      "INVALID_ESTIMATED_VALUE",
      "Enter a dollar amount with at most 2 decimal places, or leave it blank.",
    );
  }

  return cents;
}

export function parseListingFields(input: ListingFieldInput): ListingFields {
  const title = input.title.trim();
  const description = input.description.trim();
  const categoryId = input.categoryId.trim();

  if (title.length === 0 || title.length > 100) {
    throw new DomainError("INVALID_LISTING", "Title must be 1 to 100 characters.");
  }
  if (description.length === 0 || description.length > 2000) {
    throw new DomainError(
      "INVALID_LISTING",
      "Description must be 1 to 2000 characters.",
    );
  }
  if (categoryId.length === 0) {
    throw new DomainError("INVALID_LISTING", "Choose a category.");
  }
  if (!CONDITIONS.includes(input.condition as ConditionValue)) {
    throw new DomainError("INVALID_LISTING", "Choose a condition.");
  }

  const conditionNotes = blankToNull(input.conditionNotes);
  const lookingFor = blankToNull(input.lookingFor);
  if (conditionNotes && conditionNotes.length > 300) {
    throw new DomainError(
      "INVALID_LISTING",
      "Condition notes must be 300 characters or fewer.",
    );
  }
  if (lookingFor && lookingFor.length > 300) {
    throw new DomainError(
      "INVALID_LISTING",
      "Looking for must be 300 characters or fewer.",
    );
  }

  return {
    title,
    categoryId,
    condition: input.condition as ConditionValue,
    description,
    conditionNotes,
    estimatedValueCents: parseEstimatedValue(input.estimatedValue),
    lookingFor,
  };
}

export function validatePhotoSet(photos: PhotoCandidate[]): void {
  if (photos.length < 1 || photos.length > 3) {
    throw new DomainError("INVALID_PHOTOS", "Add 1 to 3 photos.");
  }

  for (const photo of photos) {
    if (photo.sizeBytes > PHOTO_MAX_BYTES) {
      throw new DomainError("INVALID_PHOTOS", "Each photo must be 5 MB or smaller.");
    }

    const isJpeg =
      photo.mimeType === "image/jpeg" && headerMatches(photo.header, JPEG_MAGIC);
    const isPng =
      photo.mimeType === "image/png" && headerMatches(photo.header, PNG_MAGIC);
    if (!isJpeg && !isPng) {
      throw new DomainError("INVALID_PHOTOS", "Photos must be JPEG or PNG.");
    }
  }
}

export function isListingLocked(input: {
  status: ListingStatusValue;
  inPendingOffer: boolean;
}): boolean {
  if (input.status === "InTrade" || input.status === "Traded") return true;
  return input.inPendingOffer;
}

export function listingControls(locked: boolean): {
  showEdit: boolean;
  showDelete: boolean;
} {
  return { showEdit: !locked, showDelete: !locked };
}

export function conditionLabel(condition: ConditionValue): string {
  return CONDITION_LABELS[condition];
}

export function statusLabel(status: ListingStatusValue): string {
  if (status === "InTrade") return "In trade";
  if (status === "Traded") return "Traded";
  return "Available";
}

export function formatFairnessHint(cents: number): string {
  const dollars = Math.trunc(cents / 100);
  const fraction = String(Math.abs(cents % 100)).padStart(2, "0");
  return `$${dollars}.${fraction}`;
}

export function centsToDollarInput(cents: number | null): string {
  if (cents == null) return "";
  const dollars = Math.trunc(cents / 100);
  const fraction = Math.abs(cents % 100);
  if (fraction === 0) return String(dollars);
  return `${dollars}.${String(fraction).padStart(2, "0")}`;
}

export function showMakeOffer(input: {
  status: ListingStatusValue;
  viewerId: string | null;
  ownerId: string;
}): boolean {
  return input.status === "Available" && input.viewerId !== input.ownerId;
}

export function makeOfferHref(input: {
  viewerId: string | null;
  listingId: string;
}): string | null {
  if (input.viewerId) return null;
  return `/sign-in?callbackUrl=${encodeURIComponent(`/listings/${input.listingId}`)}`;
}
