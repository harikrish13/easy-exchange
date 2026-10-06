"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/action-result";
import { markReceivedAction } from "@/server/actions/completion";

export function MarkReceivedForm({ offerId }: { offerId: string }) {
  const [state, action, pending] = useActionState(markReceivedAction, null as FormState);

  return (
    <form action={action}>
      <input type="hidden" name="tradeOfferId" value={offerId} />
      <button className="button" type="submit" disabled={pending}>
        Mark received
      </button>
      {state?.ok === false ? (
        <p className="error" role="alert">
          {state.error.message}
        </p>
      ) : null}
    </form>
  );
}
