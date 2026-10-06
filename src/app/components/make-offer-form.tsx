"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/action-result";
import { proposeOfferAction } from "@/server/actions/offers";

export function MakeOfferForm({
  targetListingId,
  listings,
}: {
  targetListingId: string;
  listings: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(proposeOfferAction, null as FormState);

  if (listings.length === 0) {
    return (
      <p>
        List an available item before you make an offer. <a href="/listings/new">List an item</a>
      </p>
    );
  }

  return (
    <form className="form" action={action}>
      <input type="hidden" name="targetListingId" value={targetListingId} />
      {state ? (
        <p className="error" role="alert">
          {state.error.message}
        </p>
      ) : null}
      <fieldset className="choices">
        <legend>Your items</legend>
        {listings.map((listing) => (
          <label className="check" key={listing.id}>
            <input type="checkbox" name="offeredListingIds" value={listing.id} />
            {listing.title}
          </label>
        ))}
      </fieldset>
      <p className="hint">Choose 1 to 3 available items of yours.</p>
      <button className="button" type="submit" disabled={pending}>
        Make offer
      </button>
    </form>
  );
}
