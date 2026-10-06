"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/action-result";
import { deleteListingAction } from "@/server/actions/listings";

export function DeleteListingButton({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState(
    deleteListingAction,
    null as FormState,
  );

  return (
    <form action={action}>
      <input type="hidden" name="listingId" value={listingId} />
      <button className="danger" type="submit" disabled={pending}>
        Delete listing
      </button>
      {state ? (
        <p className="error" role="alert">
          {state.error.message}
        </p>
      ) : null}
    </form>
  );
}
