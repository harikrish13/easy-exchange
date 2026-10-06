"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/action-result";
import { signUpAction } from "@/server/actions/auth";

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, null as FormState);

  return (
    <form className="form" action={action}>
      {state ? (
        <p className="error" role="alert">
          {state.error.message}
        </p>
      ) : null}
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="hint">At least 8 characters.</span>
      </label>
      <label>
        Display name
        <input name="displayName" type="text" autoComplete="nickname" required />
      </label>
      <label>
        City (optional)
        <input name="city" type="text" autoComplete="address-level2" />
      </label>
      <button className="button" type="submit" disabled={pending}>
        Create account
      </button>
    </form>
  );
}
