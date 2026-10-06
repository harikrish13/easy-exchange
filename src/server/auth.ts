import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { publicSession } from "@/domain/session";
import { authenticateCredentials } from "./users";

if (!process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET is required");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) =>
        authenticateCredentials(credentials?.email, credentials?.password),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id && user.displayName) {
        const publicUser = publicSession({
          id: user.id,
          displayName: user.displayName,
          email: "email" in user ? user.email : undefined,
        });
        token.id = publicUser.id;
        token.displayName = publicUser.displayName;
      }
      delete token.email;
      return token;
    },
    session({ session, token }) {
      if (
        typeof token.id !== "string" ||
        typeof token.displayName !== "string" ||
        token.id.length === 0 ||
        token.displayName.length === 0
      ) {
        return {
          expires: session.expires,
          user: { id: "", displayName: "" },
        };
      }

      return {
        expires: session.expires,
        user: publicSession({
          id: token.id,
          displayName: token.displayName,
          email: token.email,
        }),
      };
    },
  },
});

export const AUTH_REQUIRED_CODE = "AUTH_REQUIRED";

export type CurrentUser = {
  id: string;
  displayName: string;
};

export type AuthGateResult =
  | { ok: true; user: CurrentUser }
  | {
      ok: false;
      error: { code: typeof AUTH_REQUIRED_CODE; message: string };
    };

export async function requireUser(): Promise<AuthGateResult> {
  const session = await auth();
  const id = session?.user?.id;
  const displayName = session?.user?.displayName;
  if (!id || !displayName) {
    return {
      ok: false,
      error: {
        code: AUTH_REQUIRED_CODE,
        message: "Sign in required.",
      },
    };
  }

  return { ok: true, user: { id, displayName } };
}
