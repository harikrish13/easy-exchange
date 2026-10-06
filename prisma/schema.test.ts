import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  path.join(process.cwd(), "prisma", "schema.prisma"),
  "utf8",
);

function modelBlock(name: string): string {
  const match = schema.match(
    new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`),
  );
  expect(match, `model ${name} exists`).not.toBeNull();
  return match?.[1] ?? "";
}

function enumBlock(name: string): string {
  const match = schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`));
  expect(match, `enum ${name} exists`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("Prisma schema", () => {
  it("gives every model a string cuid primary key", () => {
    const models = [
      "User",
      "Category",
      "Listing",
      "ListingPhoto",
      "TradeOffer",
      "TradeOfferItem",
      "Rating",
    ];

    for (const name of models) {
      const block = modelBlock(name);
      expect(block).toMatch(/id\s+String\s+@id\s+@default\(cuid\(\)\)/);
    }
  });

  it("defines listing and offer status enums exactly", () => {
    expect(enumBlock("ListingStatus")).toMatch(
      /Available\s+InTrade\s+Traded/,
    );
    expect(enumBlock("TradeOfferStatus")).toMatch(
      /Pending\s+Accepted\s+Declined\s+Cancelled\s+Completed/,
    );
  });

  it("defines condition and cancelled-by enums exactly", () => {
    expect(enumBlock("Condition")).toMatch(
      /Mint\s+NearMint\s+Excellent\s+Good\s+Fair/,
    );
    expect(enumBlock("CancelledBy")).toMatch(/PROPOSER\s+SYSTEM/);
  });

  it("stores categories as a table with a unique slug", () => {
    const category = modelBlock("Category");
    expect(category).toMatch(/name\s+String/);
    expect(category).toMatch(/slug\s+String\s+@unique/);
    expect(modelBlock("Listing")).toMatch(/categoryId\s+String/);
    expect(schema).not.toMatch(/enum Category/);
  });

  it("matches listing fields including nullable estimated value", () => {
    const listing = modelBlock("Listing");
    expect(listing).toMatch(/ownerId\s+String/);
    expect(listing).toMatch(/title\s+String/);
    expect(listing).toMatch(/description\s+String/);
    expect(listing).toMatch(/condition\s+Condition/);
    expect(listing).toMatch(/conditionNotes\s+String\?/);
    expect(listing).toMatch(/estimatedValueCents\s+Int\?/);
    expect(listing).toMatch(/lookingFor\s+String\?/);
    expect(listing).toMatch(/status\s+ListingStatus\s+@default\(Available\)/);
  });

  it("stores photo metadata linked to a listing", () => {
    const photo = modelBlock("ListingPhoto");
    expect(photo).toMatch(/listingId\s+String/);
    expect(photo).toMatch(/storagePath\s+String/);
    expect(photo).toMatch(/sortOrder\s+Int/);
    expect(photo).toMatch(/mimeType\s+String/);
  });

  it("models trades on TradeOffer without a Trade table", () => {
    const offer = modelBlock("TradeOffer");
    expect(offer).toMatch(/cancelledBy\s+CancelledBy\?/);
    expect(offer).toMatch(/proposerReceivedAt\s+DateTime\?/);
    expect(offer).toMatch(/receiverReceivedAt\s+DateTime\?/);
    expect(offer).toMatch(/status\s+TradeOfferStatus\s+@default\(Pending\)/);
    expect(schema).toMatch(/model TradeOfferItem/);
    expect(schema).not.toMatch(/model Trade\b/);
  });

  it("uniques offer items and ratings", () => {
    expect(modelBlock("TradeOfferItem")).toMatch(
      /@@unique\(\[tradeOfferId, listingId\]\)/,
    );
    expect(modelBlock("Rating")).toMatch(
      /@@unique\(\[tradeOfferId, raterUserId\]\)/,
    );
  });

  it("stores user credentials without a reset-token model", () => {
    const user = modelBlock("User");
    expect(user).toMatch(/email\s+String\s+@unique/);
    expect(user).toMatch(/passwordHash\s+String/);
    expect(user).toMatch(/displayName\s+String/);
    expect(user).toMatch(/city\s+String\?/);
    expect(schema).not.toMatch(/PasswordReset|resetToken|ResetToken/);
  });

  it("does not cascade-delete listings from trade relations", () => {
    const offer = modelBlock("TradeOffer");
    const item = modelBlock("TradeOfferItem");
    expect(offer).toMatch(/onDelete:\s*Restrict/);
    expect(item).toMatch(/onDelete:\s*Restrict/);
    expect(schema).not.toMatch(/onDelete:\s*Cascade/);
  });
});
