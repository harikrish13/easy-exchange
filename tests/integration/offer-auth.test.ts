import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: async () => ({
    ok: false,
    error: { code: "AUTH_REQUIRED", message: "Sign in required." },
  }),
}));

import {
  acceptOfferAction,
  cancelOfferAction,
  declineOfferAction,
  proposeOfferAction,
} from "@/server/actions/offers";
import { prisma } from "@/server/db";
import { resetDatabase } from "./helpers";

describe("protected offer actions", () => {
  beforeEach(resetDatabase);

  it("returns an auth error and does not change offers or listings", async () => {
    const form = new FormData();
    form.set("targetListingId", "target");
    form.set("tradeOfferId", "offer");
    form.append("offeredListingIds", "offered");

    for (const action of [
      proposeOfferAction,
      acceptOfferAction,
      declineOfferAction,
      cancelOfferAction,
    ]) {
      const result = await action(null, form);
      expect(result).toEqual({
        ok: false,
        error: { code: "AUTH_REQUIRED", message: "Sign in required." },
      });
    }

    expect(await prisma.tradeOffer.count()).toBe(0);
    expect(await prisma.listing.count()).toBe(0);
  });
});
