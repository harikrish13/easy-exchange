"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/action-result";
import { leaveRatingAction } from "@/server/actions/completion";

const scores = [1, 2, 3, 4, 5] as const;

export function RatingForm({ offerId }: { offerId: string }) {
  const [state, action, pending] = useActionState(leaveRatingAction, null as FormState);

  return (
    <form className="form" action={action}>
      <input type="hidden" name="tradeOfferId" value={offerId} />
      <fieldset className="choices">
        <legend>Your rating</legend>
        {scores.map((score) => (
          <label className="check" key={score}>
            <input type="radio" name="score" value={score} required={score === 1} />
            {score}
          </label>
        ))}
      </fieldset>
      <label>
        Comment, optional
        <textarea name="comment" maxLength={500} rows={4} />
      </label>
      <button className="button" type="submit" disabled={pending}>
        Submit rating
      </button>
      {state?.ok === false ? (
        <p className="error" role="alert">
          {state.error.message}
        </p>
      ) : null}
    </form>
  );
}
