import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import {
  conditionLabel,
  formatFairnessHint,
  isListingLocked,
  listingControls,
  makeOfferHref,
  parseEstimatedValue,
  parseListingFields,
  showMakeOffer,
  validatePhotoSet,
  type PhotoCandidate,
} from "./listings";

const jpeg = (size = 32): PhotoCandidate => ({
  mimeType: "image/jpeg",
  sizeBytes: size,
  header: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]),
});

const png = (size = 32): PhotoCandidate => ({
  mimeType: "image/png",
  sizeBytes: size,
  header: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
});

const validFields = {
  title: "Charizard Holo",
  categoryId: "cat_cards",
  condition: "NearMint",
  description: "A holo from a binder.",
  conditionNotes: "",
  estimatedValue: "",
  lookingFor: "",
};

describe("parseEstimatedValue", () => {
  it("stores dollar amounts as integer cents", () => {
    expect(parseEstimatedValue("12")).toBe(1200);
    expect(parseEstimatedValue("12.5")).toBe(1250);
    expect(parseEstimatedValue("12.50")).toBe(1250);
    expect(parseEstimatedValue(" 12.50 ")).toBe(1250);
  });

  it("stores a blank value as null", () => {
    expect(parseEstimatedValue("")).toBeNull();
    expect(parseEstimatedValue("   ")).toBeNull();
    expect(parseEstimatedValue(null)).toBeNull();
    expect(parseEstimatedValue(undefined)).toBeNull();
  });

  it("rejects negative, non-numeric, and 3-decimal values", () => {
    for (const raw of ["-1", "12.345", "abc", "12.5.0", "$12"]) {
      expect(() => parseEstimatedValue(raw)).toThrow(DomainError);
      try {
        parseEstimatedValue(raw);
      } catch (error) {
        expect(error).toMatchObject({ code: "INVALID_ESTIMATED_VALUE" });
      }
    }
  });
});

describe("parseListingFields", () => {
  it("trims required text and stores blank optional strings as null", () => {
    const fields = parseListingFields({
      ...validFields,
      title: "  Charizard Holo  ",
      conditionNotes: "   ",
      lookingFor: "",
    });

    expect(fields.title).toBe("Charizard Holo");
    expect(fields.conditionNotes).toBeNull();
    expect(fields.lookingFor).toBeNull();
    expect(fields.estimatedValueCents).toBeNull();
    expect(fields.condition).toBe("NearMint");
  });

  it("rejects over-limit strings", () => {
    const cases = [
      { title: "a".repeat(101) },
      { description: "a".repeat(2001) },
      { lookingFor: "a".repeat(301) },
      { conditionNotes: "a".repeat(301) },
    ];

    for (const extra of cases) {
      expect(() => parseListingFields({ ...validFields, ...extra })).toThrow(
        DomainError,
      );
    }
  });

  it("rejects an unknown condition", () => {
    expect(() =>
      parseListingFields({ ...validFields, condition: "Pristine" }),
    ).toThrow(DomainError);
  });
});

describe("validatePhotoSet", () => {
  it("accepts 1 to 3 jpeg or png photos at or under 5 MB", () => {
    expect(() => validatePhotoSet([jpeg(), png()])).not.toThrow();
    expect(() => validatePhotoSet([jpeg(5 * 1024 * 1024)])).not.toThrow();
  });

  it("rejects the wrong count, type, or size", () => {
    expect(() => validatePhotoSet([])).toThrow(DomainError);
    expect(() => validatePhotoSet([jpeg(), jpeg(), jpeg(), jpeg()])).toThrow(
      DomainError,
    );
    expect(() =>
      validatePhotoSet([
        { mimeType: "image/gif", sizeBytes: 20, header: Uint8Array.from([0x47]) },
      ]),
    ).toThrow(DomainError);
    expect(() => validatePhotoSet([jpeg(5 * 1024 * 1024 + 1)])).toThrow(
      DomainError,
    );
    expect(() =>
      validatePhotoSet([
        {
          mimeType: "image/jpeg",
          sizeBytes: 16,
          header: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
        },
      ]),
    ).toThrow(DomainError);
  });
});

describe("listing lock and controls", () => {
  it("locks pending-offer listings and in-trade or traded listings", () => {
    expect(isListingLocked({ status: "Available", inPendingOffer: false })).toBe(
      false,
    );
    expect(isListingLocked({ status: "Available", inPendingOffer: true })).toBe(
      true,
    );
    expect(isListingLocked({ status: "InTrade", inPendingOffer: false })).toBe(
      true,
    );
    expect(isListingLocked({ status: "Traded", inPendingOffer: false })).toBe(
      true,
    );
  });

  it("shows edit and delete only when unlocked", () => {
    expect(listingControls(false)).toEqual({
      showEdit: true,
      showDelete: true,
    });
    expect(listingControls(true)).toEqual({
      showEdit: false,
      showDelete: false,
    });
  });
});

describe("browse presentation", () => {
  it("labels conditions for collectors", () => {
    expect(conditionLabel("NearMint")).toBe("Near Mint");
    expect(conditionLabel("Mint")).toBe("Mint");
  });

  it("formats a fairness hint in dollars", () => {
    expect(formatFairnessHint(1250)).toBe("$12.50");
    expect(formatFairnessHint(1200)).toBe("$12.00");
  });

  it("shows Make offer only for someone else's available listing", () => {
    expect(
      showMakeOffer({
        status: "Available",
        viewerId: null,
        ownerId: "user_alex",
      }),
    ).toBe(true);
    expect(
      showMakeOffer({
        status: "Available",
        viewerId: "user_jordan",
        ownerId: "user_alex",
      }),
    ).toBe(true);
    expect(
      showMakeOffer({
        status: "Available",
        viewerId: "user_alex",
        ownerId: "user_alex",
      }),
    ).toBe(false);
    expect(
      showMakeOffer({
        status: "InTrade",
        viewerId: null,
        ownerId: "user_alex",
      }),
    ).toBe(false);
    expect(
      showMakeOffer({
        status: "Traded",
        viewerId: "user_jordan",
        ownerId: "user_alex",
      }),
    ).toBe(false);
  });

  it("sends a guest who chooses Make offer to sign in", () => {
    expect(makeOfferHref({ viewerId: null, listingId: "listing_1" })).toBe(
      "/sign-in?callbackUrl=%2Flistings%2Flisting_1",
    );
    expect(
      makeOfferHref({ viewerId: "user_jordan", listingId: "listing_1" }),
    ).toBeNull();
  });
});
