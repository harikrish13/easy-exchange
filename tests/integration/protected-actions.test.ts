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
  AUTH_REQUIRED_CODE: "AUTH_REQUIRED",
}));

import {
  createListingAction,
  deleteListingAction,
  updateListingAction,
} from "@/server/actions/listings";
import { prisma } from "@/server/db";
import { resetDatabase } from "./helpers";

describe("protected listing actions", () => {
  beforeEach(resetDatabase);

  it("returns an auth error and does not mutate without a session", async () => {
    const form = new FormData();
    form.set("title", "Should not save");
    form.set("listingId", "listing_1");

    for (const action of [createListingAction, updateListingAction, deleteListingAction]) {
      const result = await action(null, form);
      expect(result).toEqual({
        ok: false,
        error: { code: "AUTH_REQUIRED", message: "Sign in required." },
      });
    }

    expect(await prisma.listing.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });
});
