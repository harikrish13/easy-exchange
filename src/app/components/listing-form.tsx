"use client";

import { useActionState } from "react";
import {
  CONDITIONS,
  conditionLabel,
  type ConditionValue,
} from "@/domain/listings";
import type { FormState } from "@/lib/action-result";

type ListingFormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export function ListingForm({
  action,
  categories,
  submitLabel,
  includePhotos,
  listingId,
  initial,
}: {
  action: ListingFormAction;
  categories: { id: string; name: string }[];
  submitLabel: string;
  includePhotos: boolean;
  listingId?: string;
  initial?: {
    title: string;
    categoryId: string;
    condition: string;
    description: string;
    conditionNotes: string;
    estimatedValue: string;
    lookingFor: string;
  };
}) {
  const [state, formAction, pending] = useActionState(action, null as FormState);

  return (
    <form className="form" action={formAction}>
      {listingId ? <input type="hidden" name="listingId" value={listingId} /> : null}
      {state ? (
        <p className="error" role="alert">
          {state.error.message}
        </p>
      ) : null}
      <label>
        Title
        <input name="title" type="text" required maxLength={100} defaultValue={initial?.title} />
      </label>
      <label>
        Category
        <select name="categoryId" required defaultValue={initial?.categoryId ?? ""}>
          <option value="" disabled>
            Choose a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Condition
        <select name="condition" required defaultValue={initial?.condition ?? "Good"}>
          {CONDITIONS.map((condition) => (
            <option key={condition} value={condition}>
              {conditionLabel(condition as ConditionValue)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Description
        <textarea name="description" required maxLength={2000} defaultValue={initial?.description} />
      </label>
      <label>
        Condition notes (optional)
        <input
          name="conditionNotes"
          type="text"
          maxLength={300}
          defaultValue={initial?.conditionNotes}
        />
      </label>
      <label>
        Fairness hint in dollars (optional)
        <input
          name="estimatedValue"
          type="text"
          inputMode="decimal"
          defaultValue={initial?.estimatedValue}
        />
        <span className="hint">Collectors use this to judge a swap. It is not a price.</span>
      </label>
      <label>
        Looking for (optional)
        <input name="lookingFor" type="text" maxLength={300} defaultValue={initial?.lookingFor} />
      </label>
      {includePhotos ? (
        <label>
          Photos
          <input name="photos" type="file" accept="image/jpeg,image/png" multiple required />
          <span className="hint">1 to 3 JPEG or PNG photos, up to 5 MB each.</span>
        </label>
      ) : (
        <p className="hint">Photos stay as they were when you listed the item.</p>
      )}
      <button className="button" type="submit" disabled={pending}>
        {submitLabel}
      </button>
    </form>
  );
}
