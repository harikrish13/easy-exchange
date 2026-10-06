"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-result";
import { formString } from "@/lib/form-string";
import { proposeSchema } from "@/lib/offer-schema";
import { toActionError } from "@/server/action-error";
import { requireUser } from "@/server/auth";
import { acceptTrade, cancelTrade, declineTrade, proposeTrade } from "@/server/offers";

function refreshOffers() {
  revalidatePath("/offers");
  revalidatePath("/offers/incoming");
  revalidatePath("/");
  revalidatePath("/mine");
  revalidatePath("/listings", "layout");
}

function readPropose(formData: FormData) {
  const offeredListingIds = formData
    .getAll("offeredListingIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  return proposeSchema.parse({
    targetListingId: formString(formData, "targetListingId"),
    offeredListingIds,
  });
}

export async function proposeOfferAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  try {
    await proposeTrade(gate.user.id, readPropose(formData));
    refreshOffers();
    redirect("/offers");
  } catch (error) {
    return toActionError(error);
  }
}

async function decide(
  formData: FormData,
  run: (actorId: string, tradeOfferId: string) => Promise<void>,
): Promise<FormState> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  try {
    await run(gate.user.id, formString(formData, "tradeOfferId"));
    refreshOffers();
    return null;
  } catch (error) {
    return toActionError(error);
  }
}

export async function acceptOfferAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return decide(formData, acceptTrade);
}

export async function declineOfferAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return decide(formData, declineTrade);
}

export async function cancelOfferAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return decide(formData, cancelTrade);
}
