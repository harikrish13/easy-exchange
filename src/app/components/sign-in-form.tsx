"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/action-result";
import { signInAction } from "@/server/actions/auth";

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState(signInAction, null as FormState);

  return (
    <form className="form" action={action}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
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
          autoComplete="current-password"
          required
        />
      </label>
      <button className="button" type="submit" disabled={pending}>
        Sign in
      </button>
    </form>
  );
}
