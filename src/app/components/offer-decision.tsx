"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/action-result";
import {
  acceptOfferAction,
  cancelOfferAction,
  declineOfferAction,
} from "@/server/actions/offers";

const actions = {
  accept: acceptOfferAction,
  decline: declineOfferAction,
  cancel: cancelOfferAction,
} as const;

const labels = {
  accept: "Accept",
  decline: "Decline",
  cancel: "Cancel offer",
} as const;

export function OfferDecision({
  offerId,
  kind,
}: {
  offerId: string;
  kind: keyof typeof actions;
}) {
  const [state, action, pending] = useActionState(actions[kind], null as FormState);
  const className = kind === "accept" ? "button" : "danger";

  return (
    <form action={action}>
      <input type="hidden" name="tradeOfferId" value={offerId} />
      <button className={className} type="submit" disabled={pending}>
        {labels[kind]}
      </button>
      {state ? (
        <p className="error" role="alert">
          {state.error.message}
        </p>
      ) : null}
    </form>
  );
}
