"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-result";
import { formString } from "@/lib/form-string";
import { toActionError } from "@/server/action-error";
import { requireUser } from "@/server/auth";
import {
  createListing,
  deleteListing,
  readListingForm,
  readPhotos,
  rejectPhotoChange,
  updateListing,
} from "@/server/listings";

function refreshListing(listingId: string) {
  revalidatePath("/");
  revalidatePath("/mine");
  revalidatePath(`/listings/${listingId}`);
}

export async function createListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  try {
    const created = await createListing(
      gate.user.id,
      readListingForm(formData),
      await readPhotos(formData),
    );
    refreshListing(created.id);
    redirect(`/listings/${created.id}`);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  const listingId = formString(formData, "listingId");
  try {
    rejectPhotoChange(formData);
    await updateListing(gate.user.id, listingId, readListingForm(formData));
    refreshListing(listingId);
    redirect(`/listings/${listingId}`);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  const listingId = formString(formData, "listingId");
  try {
    await deleteListing(gate.user.id, listingId);
    revalidatePath("/");
    revalidatePath("/mine");
    redirect("/mine");
  } catch (error) {
    return toActionError(error);
  }
}
