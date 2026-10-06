Status: Approved

# Data Model

Traces to: Key domain concepts and rules; Tech stack (chosen); MVP features (Must); Risks and decided constraints

## Purpose

This spec defines the Prisma/SQLite persistence model for Easy Exchange: entities, enums, relationships, and integrity constraints that later feature specs must use by name. It encodes listing and trade-offer statuses from the plan so domain logic and the database stay aligned. It does not define UI flows or Server Action APIs.

## In scope

- Prisma-style models, enums, and relations for MVP persistence
- Listing status and trade-offer status enums (including `Completed`)
- Uniqueness and nullability rules that belong in the schema
- Alignment with `00-architecture.md` (SQLite, photos as DB metadata + `uploads/` files, no separate Trade table)

## Out of scope

- Auth.js adapter tables for database sessions (JWT sessions; see `00-architecture.md` / `02-auth-and-users.md`)
- Wishlist or other Should features
- Migration step-by-step commands
- Domain transition algorithms (those live in `src/domain` per `00-architecture.md` and feature specs)
- Exact on-disk photo path layout (open in architecture; metadata fields only here)

## Business rules

1. 01-R1: All primary keys are string IDs generated with Prisma `cuid()`.
2. 01-R2: `ListingStatus` enum values are exactly `Available`, `InTrade`, and `Traded`.
3. 01-R3: `TradeOfferStatus` enum values are exactly `Pending`, `Accepted`, `Declined`, `Cancelled`, and `Completed`.
4. 01-R4: `Condition` enum values are exactly `Mint`, `NearMint`, `Excellent`, `Good`, and `Fair` (plan labels “Near Mint” maps to `NearMint`).
5. 01-R5: `Category` is a table (`id`, `name`, `slug`) with unique `slug`; MVP categories are seeded rows, not a Prisma enum, so new categories can be added later without a schema enum migration.
6. 01-R6: A `Listing` belongs to one `User` (`ownerId`) and one `Category` (`categoryId`); it has required `title`, `description`, `condition`, and `status`; optional `conditionNotes` (string), `estimatedValueCents` (nullable `Int`), and `lookingFor` (nullable string).
7. 01-R7: Each `Listing` has between 1 and 3 `ListingPhoto` rows (enforced in domain/listings layer; schema allows 0..n but application Must require 1–3). Each photo stores at least `id`, `listingId`, `storagePath` (relative path under `uploads/`), `sortOrder` (`Int`), and `mimeType` (`image/jpeg` | `image/png` as strings).
8. 01-R8: A `TradeOffer` has `proposerId`, `receiverId`, `targetListingId`, and `status`; optional `proposerReceivedAt` and `receiverReceivedAt` (`DateTime?`); `cancelledBy` is `CancelledBy?` where `CancelledBy` is `PROPOSER` | `SYSTEM`, and must be null unless `status` is `Cancelled` (enforced in domain; schema allows the nullability pattern).
9. 01-R9: Offered listings are modeled by `TradeOfferItem` with `tradeOfferId` + `listingId` and a unique constraint on `(tradeOfferId, listingId)`. A trade offer has 1–3 offered items (domain-enforced).
10. 01-R10: At most one `TradeOffer` with `status = Pending` may exist for a given `(proposerId, targetListingId)` (unique partial behavior enforced in domain and/or supported by application checks; document intent—SQLite/Prisma cannot express partial unique indexes easily, so domain + explicit query checks are required).
11. 01-R11: There is no separate `Trade` table; completion uses `TradeOffer.status = Completed` plus the two received timestamps.
12. 01-R12: `Rating` has `tradeOfferId`, `raterUserId`, `ratedUserId`, `score` (`Int` 1–5), optional `comment` (short string); unique on `(tradeOfferId, raterUserId)`; `raterUserId` must differ from `ratedUserId`; ratings are only creatable when the offer is `Completed` (domain-enforced).
13. 01-R13: `User` stores `email` (unique), `passwordHash`, `displayName`, optional `city`, and timestamps; no password-reset tokens in MVP.
14. 01-R14: Traded listings are retained with `status = Traded` and are never hard-deleted because they were traded; schema does not cascade-delete listings when offers complete.

## Data involved

### Enums

| Enum | Values |
|------|--------|
| `ListingStatus` | `Available`, `InTrade`, `Traded` |
| `TradeOfferStatus` | `Pending`, `Accepted`, `Declined`, `Cancelled`, `Completed` |
| `Condition` | `Mint`, `NearMint`, `Excellent`, `Good`, `Fair` |
| `CancelledBy` | `PROPOSER`, `SYSTEM` |

### Models (Prisma-style)

**User**
| Field | Type / notes |
|-------|----------------|
| `id` | `String` `@id` `@default(cuid())` |
| `email` | `String` `@unique` |
| `passwordHash` | `String` |
| `displayName` | `String` |
| `city` | `String?` |
| `createdAt` | `DateTime` `@default(now())` |
| `updatedAt` | `DateTime` `@updatedAt` |
| Relations | `listings`, `offersProposed`, `offersReceived`, `ratingsGiven`, `ratingsReceived` |

**Category**
| Field | Type / notes |
|-------|----------------|
| `id` | `String` `@id` `@default(cuid())` |
| `name` | `String` |
| `slug` | `String` `@unique` |
| Relations | `listings` |

**Listing**
| Field | Type / notes |
|-------|----------------|
| `id` | `String` `@id` `@default(cuid())` |
| `ownerId` | `String` → `User` |
| `categoryId` | `String` → `Category` |
| `title` | `String` |
| `description` | `String` |
| `condition` | `Condition` |
| `conditionNotes` | `String?` |
| `estimatedValueCents` | `Int?` |
| `lookingFor` | `String?` |
| `status` | `ListingStatus` `@default(Available)` |
| `createdAt` / `updatedAt` | `DateTime` |
| Relations | `photos`, `tradeOfferItems`, `targetedByOffers` (`TradeOffer[]` via `targetListingId`) |

**ListingPhoto**
| Field | Type / notes |
|-------|----------------|
| `id` | `String` `@id` `@default(cuid())` |
| `listingId` | `String` → `Listing` |
| `storagePath` | `String` (relative under `uploads/`) |
| `sortOrder` | `Int` |
| `mimeType` | `String` |
| `createdAt` | `DateTime` `@default(now())` |

**TradeOffer**
| Field | Type / notes |
|-------|----------------|
| `id` | `String` `@id` `@default(cuid())` |
| `proposerId` | `String` → `User` |
| `receiverId` | `String` → `User`; always set server-side from the target listing's owner, never from client input |
| `targetListingId` | `String` → `Listing` |
| `status` | `TradeOfferStatus` `@default(Pending)` |
| `cancelledBy` | `CancelledBy?` |
| `proposerReceivedAt` | `DateTime?` |
| `receiverReceivedAt` | `DateTime?` |
| `createdAt` / `updatedAt` | `DateTime` |
| Relations | `items` (`TradeOfferItem[]`), `ratings` |

**TradeOfferItem**
| Field | Type / notes |
|-------|----------------|
| `id` | `String` `@id` `@default(cuid())` |
| `tradeOfferId` | `String` → `TradeOffer` |
| `listingId` | `String` → `Listing` |
| Constraints | `@@unique([tradeOfferId, listingId])` |

**Rating**
| Field | Type / notes |
|-------|----------------|
| `id` | `String` `@id` `@default(cuid())` |
| `tradeOfferId` | `String` → `TradeOffer` |
| `raterUserId` | `String` → `User` |
| `ratedUserId` | `String` → `User` |
| `score` | `Int` (1–5; domain/Zod) |
| `comment` | `String?` |
| `createdAt` | `DateTime` `@default(now())` |
| Constraints | `@@unique([tradeOfferId, raterUserId])` |

### Relationship summary

```text
User 1—* Listing
Category 1—* Listing
Listing 1—* ListingPhoto
User 1—* TradeOffer (as proposer)
User 1—* TradeOffer (as receiver)
Listing 1—* TradeOffer (as target)
TradeOffer 1—* TradeOfferItem
Listing 1—* TradeOfferItem (as offered item)
TradeOffer 1—* Rating
User 1—* Rating (as rater / rated)
```

## User flows or API behavior

N/A — persistence model only; flows belong in feature specs (`02`–`07`).

## Acceptance criteria

### 01-AC1: Cuid primary keys

- **Given** the Prisma schema
- **When** each application model is inspected
- **Then** every model uses `String` `@id` `@default(cuid())`
- **Verifies:** 01-R1

### 01-AC2: Listing and offer status enums

- **Given** the Prisma schema enums
- **When** `ListingStatus` and `TradeOfferStatus` are inspected
- **Then** they contain exactly `Available` | `InTrade` | `Traded` and `Pending` | `Accepted` | `Declined` | `Cancelled` | `Completed` respectively
- **Verifies:** 01-R2, 01-R3

### 01-AC3: Condition and cancel enums

- **Given** the Prisma schema
- **When** `Condition` and `CancelledBy` are inspected
- **Then** `Condition` is `Mint` | `NearMint` | `Excellent` | `Good` | `Fair` and `CancelledBy` is `PROPOSER` | `SYSTEM`
- **Verifies:** 01-R4, 01-R8

### 01-AC4: Category table

- **Given** the schema and seed expectations
- **When** `Category` is inspected
- **Then** it has `id`, `name`, and unique `slug`, and listings reference `categoryId` rather than a category enum
- **Verifies:** 01-R5, 01-R6

### 01-AC5: Listing fields

- **Given** the `Listing` model
- **When** fields are inspected
- **Then** required and optional fields match 01-R6, including nullable `estimatedValueCents` as `Int?`
- **Verifies:** 01-R6

### 01-AC6: Photos metadata

- **Given** the `ListingPhoto` model
- **When** fields are inspected
- **Then** each row includes `storagePath`, `sortOrder`, and `mimeType` linked to `listingId`
- **Verifies:** 01-R7

### 01-AC7: TradeOffer shape without Trade table

- **Given** the schema
- **When** trade-related models are listed
- **Then** `TradeOffer` includes received timestamps and `cancelledBy`, offered items use `TradeOfferItem`, and no `Trade` model exists
- **Verifies:** 01-R8, 01-R9, 01-R11

### 01-AC8: Join uniqueness

- **Given** `TradeOfferItem`
- **When** constraints are inspected
- **Then** `@@unique([tradeOfferId, listingId])` is present
- **Verifies:** 01-R9

### 01-AC9: Pending uniqueness intent

- **Given** domain/data-access code for creating offers (when implemented)
- **When** a second Pending offer is attempted for the same proposer and target listing
- **Then** the operation is rejected (application-enforced unique Pending pair)
- **Verifies:** 01-R10

### 01-AC10: Rating constraints

- **Given** the `Rating` model and domain rules
- **When** schema and create-rating logic are inspected
- **Then** `@@unique([tradeOfferId, raterUserId])` exists, self-ratings are rejected, and creates require `TradeOffer.status = Completed`
- **Verifies:** 01-R12

### 01-AC11: User credentials fields

- **Given** the `User` model
- **When** fields are inspected
- **Then** unique `email`, `passwordHash`, `displayName`, and optional `city` exist, and no password-reset token model is defined
- **Verifies:** 01-R13

### 01-AC12: Traded retention

- **Given** relations from `TradeOffer` / `TradeOfferItem` to `Listing`
- **When** delete behaviors are inspected
- **Then** completing a trade does not cascade-delete listing rows; traded listings remain with status `Traded`
- **Verifies:** 01-R14

## Edge cases and error handling

- Prisma/SQLite cannot natively enforce “`cancelledBy` null unless Cancelled”, “1–3 photos”, “1–3 offer items”, “score 1–5”, or “partial unique Pending offers”; those are domain/Zod responsibilities called out in the rules above.
- Deleting a `User` in MVP should be disallowed or restricted if they own listings/offers (policy deferred to auth/users spec); avoid silent orphan cascades in schema design—prefer `onDelete: Restrict` for ownership FKs unless a later spec says otherwise.
- A listing used as both target and offered item in the same offer is invalid at the domain layer (not a separate schema constraint).
- `estimatedValueCents` must never be treated as a payment amount in application copy (plan fairness hint only).

## Open questions

- [ ] Confirm FK `onDelete` policy for all relations as `Restrict` (recommended default above) vs selective `Cascade` for `ListingPhoto` when a listing is deleted while `Available`.
- [ ] Max length limits for `title`, `description`, `lookingFor`, `conditionNotes`, and rating `comment` (finalize in feature specs if not set here).
- [ ] If the installed Prisma version doesn't support enums on SQLite, store these as `String` and enforce values with Zod and the domain layer.
