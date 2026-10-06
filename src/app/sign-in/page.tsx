import type { Metadata } from "next";
import { safeCallbackUrl } from "@/lib/callback-url";
import { SignInForm } from "../components/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in - Easy Exchange",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/",
  );

  return (
    <div className="wrap page">
      <h1>Sign in</h1>
      {params.created === "1" ? (
        <p className="lede">Account created. Sign in to continue.</p>
      ) : (
        <p className="lede">Use the email and password from your account.</p>
      )}
      <SignInForm callbackUrl={callbackUrl} />
      <p>
        <a href="/sign-up">Create account</a>
      </p>
    </div>
  );
}
