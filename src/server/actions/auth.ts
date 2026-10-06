"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-result";
import { safeCallbackUrl } from "@/lib/callback-url";
import { formString } from "@/lib/form-string";
import { toActionError } from "@/server/action-error";
import { signIn, signOut } from "@/server/auth";
import { registerFromForm } from "@/server/users";

export async function signUpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await registerFromForm(formData);
  } catch (error) {
    return toActionError(error);
  }
  redirect("/sign-in?created=1");
}

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const callbackUrl = safeCallbackUrl(formString(formData, "callbackUrl"));
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        },
      };
    }
    throw error;
  }
  return null;
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
