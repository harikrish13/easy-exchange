"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/action-result";
import { formString } from "@/lib/form-string";
import { ratingSchema, tradeOfferIdSchema } from "@/lib/offer-schema";
import { toActionError } from "@/server/action-error";
import { requireUser } from "@/server/auth";
import { leaveRating, markItemReceived } from "@/server/completion";

function refreshTrade(tradeOfferId: string) {
  revalidatePath("/offers");
  revalidatePath("/offers/incoming");
  revalidatePath(`/offers/${tradeOfferId}`);
  revalidatePath("/");
  revalidatePath("/mine");
  revalidatePath("/listings", "layout");
}

export async function markReceivedAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  try {
    const tradeOfferId = tradeOfferIdSchema.parse({
      tradeOfferId: formString(formData, "tradeOfferId"),
    }).tradeOfferId;
    await markItemReceived(gate.user.id, tradeOfferId);
    refreshTrade(tradeOfferId);
    return null;
  } catch (error) {
    return toActionError(error);
  }
}

export async function leaveRatingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  try {
    const parsed = ratingSchema.parse({
      tradeOfferId: formString(formData, "tradeOfferId"),
      score: formString(formData, "score"),
      comment: formString(formData, "comment"),
    });
    await leaveRating(gate.user.id, parsed);
    refreshTrade(parsed.tradeOfferId);
    return null;
  } catch (error) {
    return toActionError(error);
  }
}
