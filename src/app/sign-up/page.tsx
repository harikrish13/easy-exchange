import type { Metadata } from "next";
import { SignUpForm } from "../components/sign-up-form";

export const metadata: Metadata = {
  title: "Create account - Easy Exchange",
};

export default function SignUpPage() {
  return (
    <div className="wrap page">
      <h1>Create an account</h1>
      <p className="lede">
        Your display name is how other collectors see you. It can&apos;t be changed later.
      </p>
      <SignUpForm />
      <p>
        <a href="/sign-in">Sign in</a>
      </p>
    </div>
  );
}
