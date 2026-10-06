Status: Approved

# Architecture

Traces to: Tech stack (chosen); MVP features (Must); Risks and decided constraints (photos)

## Purpose

This spec defines how Easy Exchange is structured as a Next.js App Router application so one developer can implement features consistently in about a week. It separates UI, server boundary, domain rules, and data access so trade and listing rules stay testable without Next.js. It also fixes auth, photo storage, testing, and coding conventions for the MVP.

## In scope

- Layer responsibilities and import boundaries
- Domain layer as plain TypeScript (no Next.js / Prisma imports)
- Repository folder structure under `src/`
- Auth.js v5 Credentials + JWT session approach and how server code reads the current user
- Local filesystem photo upload, validation, storage, and serving
- Testing tools and placement (unit vs integration; no browser E2E in MVP)
- Naming, validation (Zod), and error-handling conventions

## Out of scope

- Prisma schema and entity field lists (see `01-data-model.md`)
- Feature-specific business rules beyond architectural constraints (listings, offers, completion specs)
- Playwright browser E2E (Should for later; not Must)
- Deployment topology beyond local SQLite + local `uploads/`
- Password reset, OAuth providers, and email verification

## Business rules

1. 00-R1: Application code lives under `src/` with these top-level areas: `src/app` (UI routes and layouts), `src/domain` (pure business logic), `src/server` (server actions, data access, auth helpers used only on the server), and `src/lib` (shared non-domain utilities such as Zod schemas used at boundaries).
2. 00-R2: UI code (files under `src/app` that are Client Components, and presentational components) must not import Prisma, `src/server` data-access modules, or Node filesystem APIs.
3. 00-R3: All trade-offer state transitions, conflict auto-cancel logic, and listing status transitions are implemented in `src/domain` as plain TypeScript with no imports from `next`, `next-auth`, or `@prisma/client`.
4. 00-R4: Mutations that change application state use Server Actions as the primary write path. Route Handlers are allowed only for Auth.js endpoints and for serving uploaded photo files.
5. 00-R5: Server Actions validate inputs with Zod schemas before calling domain or data-access code; TypeScript types for those inputs are derived from the Zod schemas (for example via `z.infer`).
6. 00-R6: Prisma is used only inside `src/server` data-access modules (and seed scripts). Domain and UI layers never import `@prisma/client` or a Prisma client singleton.
7. 00-R7: Authentication uses Auth.js v5 with the Credentials provider, JWT sessions, and bcrypt password hashing. The Auth.js / `next-auth` dependency is pinned to an exact version in `package.json` (no `^` / `~` range on that package).
8. 00-R8: Server-side code that needs the current user obtains the session via Auth.js server helpers (for example `auth()`); unauthenticated callers of protected Server Actions receive a structured auth error and perform no mutation.
9. 00-R9: Listing photos are stored on the local filesystem under `uploads/` (gitignored). Allowed types are JPEG and PNG only; each file is at most 5 MB; each listing has 1–3 photos. Photos are served through a Route Handler, not as static files from `public/`.
10. 00-R10: Seed/demo photo source files live in a committed directory (for example `prisma/seed-assets/`); the seed script copies them into `uploads/` as needed.
11. 00-R11: Domain logic is unit-tested with Vitest under `src/domain/**/*.test.ts` (or colocated `*.test.ts` next to domain modules). Integration tests use Vitest against a separate SQLite database file (not the dev DB) and live under `tests/integration/`.
12. 00-R12: Domain and server errors that represent rule violations use a small typed error pattern (for example a `DomainError` / `AppError` with a stable `code` string); Server Actions map these to user-safe results instead of throwing opaque failures to the UI.
13. 00-R13: Playwright (or other browser E2E) is not part of the MVP Must set; release confidence for the course demo uses unit tests, integration tests, and a manual demo checklist.

## Data involved

| Entity / artifact | Fields / notes |
|-------------------|----------------|
| N/A for domain entities | Entity schemas belong in `01-data-model.md`. This spec only constrains where persistence and files live. |
| Session (JWT) | Auth.js JWT session carrying at least user id and display-facing identity fields needed by the UI; exact claims defined when implementing auth (`02-auth-and-users.md`). |
| Photo files | Paths under `uploads/`; metadata association to listings is defined in the data-model / listings specs. |
| SQLite databases | Dev DB per Prisma config; separate file for integration tests. |

## User flows or API behavior

N/A — this is an architecture spec; end-user flows are defined in feature specs (`02`–`07`).

### Boundary behavior (architectural)

1. **Protected mutation** — Client invokes a Server Action → Zod parse → session check → load entities via data access → domain function applies rules → data access persists → return success or typed error result.
2. **Photo upload (create/update listing)** — Server Action receives files → validate type/size/count → write under `uploads/` → persist photo records via data access (details in listings spec).
3. **Photo read** — Browser requests photo URL → Route Handler checks authorization rules defined in listings/browse specs → streams file from `uploads/`.
4. **Auth** — Credentials sign-in via Auth.js Route Handlers; passwords verified with bcrypt against stored hashes.

## Acceptance criteria

### 00-AC1: Folder layout

- **Given** the repository after scaffolding
- **When** the `src/` tree is inspected
- **Then** `src/app`, `src/domain`, `src/server`, and `src/lib` exist and match the responsibilities in 00-R1
- **Verifies:** 00-R1

### 00-AC2: UI does not touch Prisma

- **Given** the codebase
- **When** imports in Client Components and presentational UI modules are inspected (for example via search for `@prisma/client` under UI paths)
- **Then** no UI module imports Prisma or server data-access modules
- **Verifies:** 00-R2, 00-R6

### 00-AC3: Domain stays framework-free

- **Given** files under `src/domain`
- **When** their import graphs are inspected
- **Then** none import `next`, `next-auth` / Auth.js, or `@prisma/client`, and trade-offer transitions, conflict auto-cancel, and listing status changes are defined there
- **Verifies:** 00-R3

### 00-AC4: Write path is Server Actions

- **Given** features that create or update listings, offers, completions, or ratings
- **When** their write entry points are inspected
- **Then** they are Server Actions; the only Route Handlers present for HTTP are Auth.js and photo serving
- **Verifies:** 00-R4

### 00-AC5: Zod at the boundary

- **Given** a Server Action that accepts user input
- **When** its implementation is inspected
- **Then** it parses input with a Zod schema and uses types derived from that schema
- **Verifies:** 00-R5

### 00-AC6: Auth pinning and credentials

- **Given** `package.json` and the auth configuration module
- **When** dependencies and providers are inspected
- **Then** Auth.js / `next-auth` is an exact pinned version, Credentials + JWT are configured, and password verification uses bcrypt
- **Verifies:** 00-R7

### 00-AC7: Session gate on mutations

- **Given** a protected Server Action
- **When** it is invoked without a valid session
- **Then** it returns a structured auth error and does not call mutating data-access methods
- **Verifies:** 00-R8, 00-R12

### 00-AC8: Photo storage and serving

- **Given** the repo config and photo code paths
- **When** storage location, validation, and HTTP serving are inspected
- **Then** files go under gitignored `uploads/`, JPEG/PNG and 5 MB limits are enforced, and serving uses a Route Handler (not `public/` static hosting)
- **Verifies:** 00-R9

### 00-AC9: Seed photo copy

- **Given** the seed script and committed seed asset folder
- **When** seeding is run on a clean `uploads/` directory
- **Then** seed photos are copied from the committed assets folder into `uploads/`
- **Verifies:** 00-R10

### 00-AC10: Test layout and tools

- **Given** the test setup
- **When** unit and integration tests are inspected
- **Then** Vitest runs domain unit tests under `src/domain`, integration tests under `tests/integration/` use a separate SQLite file, and no Playwright MVP dependency is required
- **Verifies:** 00-R11, 00-R13

### 00-AC11: Typed domain errors

- **Given** a domain rule violation (for example an illegal offer transition)
- **When** the domain function rejects the operation
- **Then** it signals failure via the typed error/`code` pattern, and the Server Action maps it to a user-safe result
- **Verifies:** 00-R12

## Edge cases and error handling

- Invalid photo type or oversize file: reject before write; do not leave partial listing photo sets in an inconsistent state (transaction/order details belong in the listings spec).
- Missing file on disk for a stored photo path: photo Route Handler returns a not-found response.
- Integration tests must never point `DATABASE_URL` at the developer database file.
- Auth misconfiguration (missing secret): app must fail fast at startup or first auth use rather than silently disabling auth.
- Domain purity regressions: adding a Next.js import to `src/domain` is treated as a spec violation even if tests still pass.

## Open questions

- [ ] Exact Auth.js v5 package version string to pin (choose at install time and record in `02-auth-and-users.md` or here when locked).
- [ ] Exact relative path convention for files inside `uploads/` (for example `uploads/listings/{listingId}/{filename}`) — finalize in `03-listings.md` if not fixed during scaffolding.
- [ ] Whether photo Route Handler URLs are opaque IDs only or include listing id; finalize with browse/listings auth rules for who may view photos of `InTrade` / `Traded` items.
