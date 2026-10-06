Status: Approved

# Auth and Users

Traces to: MVP features (Must — public sign-up); Key domain concepts and rules (User); Won't (password reset, verification beyond email); Tech stack (chosen)

## Purpose

This spec defines how collectors create an account and sign in so later features can identify the current user. Registration stores credentials and a display name; sessions stay small and do not expose email. Profile changes and password reset are out of MVP.

## In scope

- Public sign-up and sign-in with email and password
- JWT session via Auth.js v5 Credentials (`user.id`, `displayName` only)
- bcrypt `passwordHash` on `User`
- Session check for protected Server Actions

## Out of scope

- Profile editing (`displayName` / `city` after registration)
- Password reset, email verification, OAuth
- Report/block
- Browse or listing authorization (feature specs)

## Business rules

1. 02-R1: Sign-up creates a `User` with unique `email`, bcrypt `passwordHash`, required `displayName`, and optional `city`.
2. 02-R2: Password length is at least 8 characters; no complexity rules.
3. 02-R3: `displayName` and `city` are set only at registration. Profile editing is Won't for MVP.
4. 02-R4: Sign-in uses Auth.js v5 Credentials and a JWT session that exposes only `user.id` and `displayName`. `email` stays server-side.
5. 02-R5: The `next-auth` dependency is pinned to an exact version in `package.json` (see 00-R7).
6. 02-R6: Protected Server Actions read the current user with Auth.js `auth()`. With no session they return a structured auth error and perform no mutation (see 00-R8).
7. 02-R7: `passwordHash` is never sent to the client. Password reset and email verification are Won't.

## Data involved

| Entity | Fields / notes |
|--------|----------------|
| `User` | `id`, `email`, `passwordHash`, `displayName`, `city?` (from `01-data-model.md`) |
| Session (JWT) | `user.id`, `displayName` only |

## User flows or API behavior

### Sign up (Server Action)

1. Validate email, password (≥ 8), `displayName`, optional `city` with Zod.
2. Reject duplicate `email`.
3. Store bcrypt `passwordHash` and create `User`.

### Sign in / sign out (Auth.js Route Handlers)

1. Credentials: load `User` by `email`, compare password with bcrypt.
2. On success, issue JWT with `user.id` and `displayName` only.
3. Sign-out clears the session.

## Acceptance criteria

### 02-AC1: Registration fields

- **Given** a new visitor
- **When** they sign up with email, an 8+ character password, `displayName`, and optional `city`
- **Then** a `User` exists with a bcrypt `passwordHash` and those fields
- **Verifies:** 02-R1, 02-R2

### 02-AC2: No profile edit

- **Given** a signed-in user
- **When** the app surface is inspected
- **Then** there is no flow that changes `displayName` or `city` after registration
- **Verifies:** 02-R3

### 02-AC3: Session contents

- **Given** a successful sign-in
- **When** the session is read
- **Then** it includes `user.id` and `displayName` and does not include `email` or `passwordHash`
- **Verifies:** 02-R4, 02-R7

### 02-AC4: Pinned Auth.js

- **Given** `package.json`
- **When** the `next-auth` dependency is inspected
- **Then** the version is an exact pin (no `^` or `~`)
- **Verifies:** 02-R5

### 02-AC5: Protected action without session

- **Given** no session
- **When** a protected Server Action is called
- **Then** it returns a structured auth error and does not mutate data
- **Verifies:** 02-R6

## Edge cases and error handling

- Duplicate `email`: reject sign-up; do not create a second `User`.
- Password shorter than 8: Zod rejects before hashing.
- Wrong password or unknown email: sign-in fails without revealing which field was wrong.
- Missing Auth.js secret: fail fast (see `00-architecture.md`).

## Open questions

- [ ] Exact `next-auth` version string to pin (choose at install; also listed in `00-architecture.md`).
- [ ] Whether a successful sign-up also creates a session, or the user must sign in separately.
- [ ] Whether `email` is stored lowercased so uniqueness is case-insensitive.
