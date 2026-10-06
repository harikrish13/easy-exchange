import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./db";

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
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
        });
        if (!user) {
          return null;
        }

        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) {
          return null;
        }

        return {
          id: user.id,
          displayName: user.displayName,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? "";
        token.displayName = user.displayName;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id !== "string" || typeof token.displayName !== "string") {
        return session;
      }
      return {
        ...session,
        user: {
          id: token.id,
          displayName: token.displayName,
        },
      } as Session;
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
