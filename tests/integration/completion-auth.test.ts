import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("@/server/auth", () => ({
  requireUser: async () => ({
    ok: false,
    error: { code: "AUTH_REQUIRED", message: "Sign in required." },
  }),
}));

import { leaveRatingAction, markReceivedAction } from "@/server/actions/completion";
import { prisma } from "@/server/db";
import { resetDatabase } from "./helpers";

describe("protected completion actions", () => {
  beforeEach(resetDatabase);

  it("returns an auth error and does not mark received or store a rating", async () => {
    const form = new FormData();
    form.set("tradeOfferId", "offer");
    form.set("score", "5");
    form.set("comment", "Nice trade");

    for (const action of [markReceivedAction, leaveRatingAction]) {
      const result = await action(null, form);
      expect(result).toEqual({
        ok: false,
        error: { code: "AUTH_REQUIRED", message: "Sign in required." },
      });
    }

    expect(await prisma.tradeOffer.count()).toBe(0);
    expect(await prisma.rating.count()).toBe(0);
  });
});
