Status: Approved

# Seed Data

Traces to: MVP features (Must — seeded demo users, listings, and sample trade states); Problem statement and target users (class demo via seeded accounts); Key domain concepts and rules (Category, Listing status, Offer statuses, Conflict rule, Completion, Rating); Won't (password reset); Tech stack (chosen — Prisma seeding); `00-architecture.md` (00-R6, 00-R10); `01-data-model.md`; `03-listings.md` (photo paths, My listings, field limits); `04-browse.md` (public catalog is `Available` only); `05-trade-offers.md`; `06-trade-completion-and-ratings.md`

## Purpose

This spec defines the dev-database seed that makes a class demo possible without hand-building accounts. It loads three demo users, listings in every listing status, and trade offers in every offer status, including both cancel reasons and both post-accept receipt shapes, so each screen in the listing → offer → confirm → rate flow has data. The seed writes that final state directly. It does not sign anyone in and it does not run Server Actions.

## In scope

- Prisma seed script that resets and reloads the dev database
- Four MVP categories
- Three demo users with a shared known password
- Listings, photos, offers, offer items, and ratings listed in this spec
- Copying committed JPEG fixtures into `uploads/`

## Out of scope

- Sign-up, sign-in, and profile editing (`02-auth-and-users.md`)
- Browse route names (`04-browse.md`). That spec decides catalog membership: the public catalog is `Available` only and omits the signed-in user’s own listings.
- Wishlist or other Should features
- Password reset, email verification, and Auth.js session tables
- Integration-test databases (those stay separate per `00-architecture.md`)
- Replaying offer transitions through `src/domain` (the seed inserts the final rows)

## Business rules

1. 07-R1: The seed entry point is `prisma/seed.ts`. It may use Prisma. Domain and UI code must not (00-R6). It runs against the dev `DATABASE_URL` only.
2. 07-R2: Each run deletes existing `Rating`, `TradeOfferItem`, `TradeOffer`, `ListingPhoto`, `Listing`, `Category`, and `User` rows, deletes `uploads/listings/`, then inserts the catalog below and recopies photos. A second run yields the same ids, emails, titles, statuses, and relationships. User-created dev data is replaced.
3. 07-R3: Seed exactly these `Category` rows (plan names; slugs unique per 01-R5): `cat_cards` / Trading Cards / `trading-cards`; `cat_coins` / Coins / `coins`; `cat_figures` / Action Figures / `action-figures`; `cat_comics` / Comics / `comics`.
4. 07-R4: Seed exactly three users. Emails are stored lowercase. `city` is null only for Sam. There is no password-reset token.

   | id | email | displayName | city |
   |----|-------|-------------|------|
   | `user_alex` | `alex@demo.easyexchange.test` | Alex Rivera | Portland |
   | `user_jordan` | `jordan@demo.easyexchange.test` | Jordan Lee | Austin |
   | `user_sam` | `sam@demo.easyexchange.test` | Sam Patel | null |

5. 07-R5: All three users share the password `DemoPass1` (meets 02-R2). The database stores only a bcrypt `passwordHash`. The plaintext password appears in this spec and as a constant in the seed script, not in the database.
6. 07-R6: Every listing has 1–3 `ListingPhoto` rows. Fixture JPEGs live in committed `prisma/seed-assets/` (`trading-cards.jpg`, `coins.jpg`, `action-figures.jpg`, `comics.jpg`). The seed copies the listing’s category fixture into `uploads/listings/{listingId}/{photoId}.jpg`. `storagePath` is relative to `uploads/` (03-R4). `mimeType` is `image/jpeg`. `sortOrder` is 0-based in the order listed. `listing_alex_charizard` has two photos; every other listing has one. The second Charizard photo may be a second copy of the same cards fixture.
7. 07-R7: The seed includes listings in each `ListingStatus`: `Available`, `InTrade`, and `Traded`. Traded rows are kept (01-R14). `InTrade` and `Traded` rows are for listing detail, My listings, and trade screens. They are not public-catalog rows (04-R1).
8. 07-R8: The seed includes one or more `TradeOffer` rows in each `TradeOfferStatus`: `Pending`, `Accepted`, `Declined`, `Cancelled`, and `Completed`.
9. 07-R9: `Cancelled` offers cover both `cancelledBy` values. `offer_cancelled_system` targets `listing_sam_figure`, which is also an involved listing of `offer_accepted_open` (`InTrade`). Its offered listing, `listing_alex_loose_cards`, is not involved in that accepted offer and stays `Available`. `cancelledBy` is null on every non-`Cancelled` offer (01-R8, 05-R15).
10. 07-R10: Two `Accepted` offers: `offer_accepted_open` has both received timestamps null; `offer_accepted_partial` has `proposerReceivedAt` set and `receiverReceivedAt` null. Neither is `Completed`. Their involved listings stay `InTrade`.
11. 07-R11: Two `Completed` offers, both with both received timestamps set and involved listings `Traded`. `offer_completed_rated` has one `Rating` from each party. `offer_completed_unrated` has none. Scores are 1–5, each `comment` is at most 500 characters, and `raterUserId` ≠ `ratedUserId` (06-R6, 06-R7). Ratings are not updated or deleted by the seed after insert.
12. 07-R12: Every offer has exactly one target, 1–3 offered items owned by the proposer, and `receiverId` equal to the target listing’s `ownerId`. No offer targets the proposer’s own listing. The only `Pending` offer is `offer_pending`, and it is the only Pending pair for `(user_alex, listing_jordan_morgan)`. That offer has two `TradeOfferItem` rows. Insert items in the order listed.
13. 07-R13: Listing status matches involvement. A listing involved in a `Completed` offer is `Traded`. A listing involved in an `Accepted` offer and not in a `Completed` offer is `InTrade`. Every other listing is `Available`. A listing is in at most one `Accepted` or `Completed` offer. `Available` listings that appear only on `Declined` or `Cancelled` offers are not edit-locked by those offers (03-R6). `listing_alex_charizard`, `listing_alex_pikachu`, and `listing_jordan_morgan` are `Available` and edit-locked because they are on `offer_pending`.
14. 07-R14: Each category has at least one `Available` listing. Each demo user owns at least one `Available` listing that is not on `offer_pending`, so that user can still propose and can edit an unlocked listing. At least one listing sets `estimatedValueCents` and `lookingFor`; at least one leaves each of those null. At least one `Fair` listing has `conditionNotes`.
15. 07-R15: Primary keys are the ids in the catalog tables (stable across reseeds), not fresh random ids.
16. 07-R16: The seed does not create Auth.js adapter tables, sessions, or password-reset tokens.
17. 07-R17: Seed text fits the feature limits: `title` ≤ 100, `description` ≤ 2000, `lookingFor` ≤ 300, `conditionNotes` ≤ 300 (03-R10), and rating `comment` ≤ 500 (06-R7). `estimatedValueCents` values in the listing table are integer cents (03-R8); for example `12000` is $120.00. Any caller may view every seeded listing’s photos, in any status (03-R5, 04-R7). The public catalog built from this seed shows only `Available` listings and, when a session exists, omits that user’s own listings (04-R1, 04-R2). My listings for a demo user includes that user’s listings in every status (03-R11).

## Data involved

Field names match `01-data-model.md`. `estimatedValueCents` is integer cents and a fairness hint only. Descriptions below are the stored `description` text. Seed strings stay within 03-R10 and 06-R7.

### Categories

See 07-R3.

### Listings

| id | owner | category | title | condition | conditionNotes | estimatedValueCents | lookingFor | status | photos |
|----|-------|----------|-------|-----------|----------------|---------------------|------------|--------|--------|
| `listing_alex_charizard` | `user_alex` | `cat_cards` | Charizard Holo | `NearMint` | null | 12000 | Vintage coins or silver-age comics | `Available` | `photo_alex_charizard_1`, `photo_alex_charizard_2` |
| `listing_alex_pikachu` | `user_alex` | `cat_cards` | Pikachu Promo | `Mint` | null | 4000 | null | `Available` | `photo_alex_pikachu_1` |
| `listing_alex_comic` | `user_alex` | `cat_comics` | Amazing Fantasy Reprint | `Good` | null | null | Action figures | `Available` | `photo_alex_comic_1` |
| `listing_alex_loose_cards` | `user_alex` | `cat_cards` | Bulk Commons Binder | `Excellent` | null | 1500 | null | `Available` | `photo_alex_loose_cards_1` |
| `listing_alex_gi_joe` | `user_alex` | `cat_figures` | G.I. Joe Snake Eyes | `Good` | null | 3500 | Mint coins | `Available` | `photo_alex_gi_joe_1` |
| `listing_alex_figure` | `user_alex` | `cat_figures` | Vintage He-Man | `Excellent` | null | 8000 | Trading cards | `InTrade` | `photo_alex_figure_1` |
| `listing_alex_coin` | `user_alex` | `cat_coins` | Walking Liberty Half | `Fair` | Rim nick on the reverse | 2200 | null | `Traded` | `photo_alex_coin_1` |
| `listing_jordan_morgan` | `user_jordan` | `cat_coins` | 1921 Morgan Dollar | `Mint` | null | 4500 | Holo trading cards | `Available` | `photo_jordan_morgan_1` |
| `listing_jordan_penny` | `user_jordan` | `cat_coins` | 1909-S VDB Lincoln Cent | `Good` | null | 9000 | null | `Available` | `photo_jordan_penny_1` |
| `listing_jordan_extra_card` | `user_jordan` | `cat_cards` | Baseball Rookie Lot | `NearMint` | null | 3000 | Comics | `Available` | `photo_jordan_extra_card_1` |
| `listing_jordan_figure` | `user_jordan` | `cat_figures` | Star Wars Vintage Luke | `Mint` | null | 15000 | Coins | `InTrade` | `photo_jordan_figure_1` |
| `listing_jordan_card` | `user_jordan` | `cat_cards` | Worn Team Set | `Fair` | Corners rounded | 800 | null | `Traded` | `photo_jordan_card_1` |
| `listing_jordan_old_comic` | `user_jordan` | `cat_comics` | Detective Comics Reader Copy | `Good` | null | 1200 | null | `Traded` | `photo_jordan_old_comic_1` |
| `listing_sam_spawn` | `user_sam` | `cat_comics` | Spawn #1 | `Excellent` | null | 6000 | Coins or cards | `Available` | `photo_sam_spawn_1` |
| `listing_sam_batman` | `user_sam` | `cat_comics` | Batman Year One TPB | `NearMint` | null | null | null | `Available` | `photo_sam_batman_1` |
| `listing_sam_buffalo` | `user_sam` | `cat_coins` | Buffalo Nickel | `Good` | null | 500 | Action figures | `Available` | `photo_sam_buffalo_1` |
| `listing_sam_loose_figure` | `user_sam` | `cat_figures` | Loose Action Figure | `Fair` | Missing accessory | 1000 | null | `Available` | `photo_sam_loose_figure_1` |
| `listing_sam_figure` | `user_sam` | `cat_figures` | MOTU Skeletor | `Excellent` | null | 7000 | Vintage figures | `InTrade` | `photo_sam_figure_1` |
| `listing_sam_card` | `user_sam` | `cat_cards` | Holographic Starter | `Mint` | null | 5000 | null | `InTrade` | `photo_sam_card_1` |
| `listing_sam_coin` | `user_sam` | `cat_coins` | Peace Dollar | `Excellent` | null | 2800 | null | `Traded` | `photo_sam_coin_1` |

Each `description` is one sentence: `"{title} from the Easy Exchange demo seed."`

Unlocked `Available` listings (not on `offer_pending`): Alex’s comic, loose-cards binder, and G.I. Joe; Jordan’s penny and rookie lot; Sam’s Spawn, Batman TPB, buffalo nickel, and loose figure.

### Trade offers

Timestamps are UTC. `updatedAt` is the status-change time (or the received-mark time for `offer_accepted_partial`).

| id | proposer | receiver | target | status | cancelledBy | proposerReceivedAt | receiverReceivedAt | createdAt | updatedAt |
|----|----------|----------|--------|--------|-------------|--------------------|--------------------|-----------|-----------|
| `offer_completed_rated` | `user_jordan` | `user_alex` | `listing_alex_coin` | `Completed` | null | 2026-08-20T18:00:00.000Z | 2026-08-21T18:00:00.000Z | 2026-08-01T18:00:00.000Z | 2026-08-21T18:00:00.000Z |
| `offer_completed_unrated` | `user_sam` | `user_jordan` | `listing_jordan_old_comic` | `Completed` | null | 2026-09-02T18:00:00.000Z | 2026-09-03T18:00:00.000Z | 2026-08-25T18:00:00.000Z | 2026-09-03T18:00:00.000Z |
| `offer_cancelled_system` | `user_alex` | `user_sam` | `listing_sam_figure` | `Cancelled` | `SYSTEM` | null | null | 2026-09-12T18:00:00.000Z | 2026-09-15T18:00:00.000Z |
| `offer_accepted_open` | `user_jordan` | `user_sam` | `listing_sam_figure` | `Accepted` | null | null | null | 2026-09-14T18:00:00.000Z | 2026-09-15T18:00:00.000Z |
| `offer_declined` | `user_alex` | `user_sam` | `listing_sam_spawn` | `Declined` | null | null | null | 2026-09-18T18:00:00.000Z | 2026-09-19T18:00:00.000Z |
| `offer_accepted_partial` | `user_sam` | `user_alex` | `listing_alex_figure` | `Accepted` | null | 2026-10-01T15:00:00.000Z | null | 2026-09-20T18:00:00.000Z | 2026-10-01T15:00:00.000Z |
| `offer_cancelled_proposer` | `user_jordan` | `user_alex` | `listing_alex_gi_joe` | `Cancelled` | `PROPOSER` | null | null | 2026-09-22T18:00:00.000Z | 2026-09-23T18:00:00.000Z |
| `offer_pending` | `user_alex` | `user_jordan` | `listing_jordan_morgan` | `Pending` | null | null | null | 2026-10-05T18:00:00.000Z | 2026-10-05T18:00:00.000Z |

`offer_cancelled_system.updatedAt` matches `offer_accepted_open.updatedAt` because that accept is what cancelled it. The seed stores this outcome; it does not re-run conflict cancel.

### Trade offer items

| id | tradeOfferId | listingId |
|----|--------------|-----------|
| `item_pending_1` | `offer_pending` | `listing_alex_charizard` |
| `item_pending_2` | `offer_pending` | `listing_alex_pikachu` |
| `item_accepted_open_1` | `offer_accepted_open` | `listing_jordan_figure` |
| `item_accepted_partial_1` | `offer_accepted_partial` | `listing_sam_card` |
| `item_declined_1` | `offer_declined` | `listing_alex_comic` |
| `item_cancel_proposer_1` | `offer_cancelled_proposer` | `listing_jordan_penny` |
| `item_cancel_system_1` | `offer_cancelled_system` | `listing_alex_loose_cards` |
| `item_completed_rated_1` | `offer_completed_rated` | `listing_jordan_card` |
| `item_completed_unrated_1` | `offer_completed_unrated` | `listing_sam_coin` |

### Ratings

Both belong to `offer_completed_rated`. `createdAt` is 2026-08-22T18:00:00.000Z.

| id | raterUserId | ratedUserId | score | comment |
|----|-------------|-------------|-------|---------|
| `rating_jordan_alex` | `user_jordan` | `user_alex` | 5 | Smooth swap, item as described. |
| `rating_alex_jordan` | `user_alex` | `user_jordan` | 4 | Packed carefully and matched the photos. |

## User flows or API behavior

### Run the seed

1. Invoke the Prisma seed (`prisma/seed.ts` via the project’s Prisma seed command) with the dev `DATABASE_URL`.
2. The script wipes the tables in 07-R2 and `uploads/listings/`, inserts the catalog, and copies fixtures into `uploads/`.
3. It does not call Server Actions or `src/domain` transition functions.

### Class demo

Password for every account: `DemoPass1`.

| What to show | Sign in as | Seeded record |
|--------------|------------|----------------|
| Incoming Pending (Accept / Decline) and a 2-item offer | Jordan | `offer_pending` |
| Outgoing Pending | Alex | `offer_pending` |
| Accepted, neither party has marked received | Jordan or Sam | `offer_accepted_open` |
| Accepted, proposer already marked received | Sam (already marked) or Alex (still can mark) | `offer_accepted_partial` |
| Declined history | Alex or Sam | `offer_declined` |
| Proposer-cancelled history | Jordan or Alex | `offer_cancelled_proposer` (`cancelledBy = PROPOSER`) |
| System-cancelled history | Alex or Sam | `offer_cancelled_system` (`cancelledBy = SYSTEM`) |
| Completed trade with both ratings | Jordan or Alex | `offer_completed_rated` |
| Completed trade with no ratings (rate action still available) | Sam or Jordan | `offer_completed_unrated` |
| Edit or delete an unlocked listing | Alex | `listing_alex_gi_joe` |
| Edit blocked while Pending | Alex | `listing_alex_charizard` |
| Edit blocked while `InTrade` | Alex | `listing_alex_figure` |
| Edit blocked while `Traded` | Alex | `listing_alex_coin` |
| Listing detail: two photos, value hint, looking-for, owner city | any | `listing_alex_charizard` |
| Listing detail: no value hint | any | `listing_sam_batman` |
| Owner with no city | any | a listing owned by `user_sam` |
| Create listing (category dropdown) | any | the four categories |
| Propose using a still-`Available` item of theirs | Alex, Jordan, or Sam | that user’s unlocked `Available` listings in 07-R14 |
| Browse another user’s `Available` listing in each category | any of the three | each category has an `Available` listing owned by someone else |
| Public catalog excludes `InTrade` and `Traded` | guest | only `Available` rows; `listing_alex_figure` and `listing_alex_coin` are not catalog rows |
| My listings, every status | Alex | `listing_alex_gi_joe` (`Available`, edit/delete shown), `listing_alex_charizard` (`Available`, locked, no edit/delete), `listing_alex_figure` (`InTrade`), `listing_alex_coin` (`Traded`) |
| Photos on an `InTrade` or `Traded` listing | any caller | `listing_alex_figure`, `listing_alex_coin` |
| Completed offer detail, ratings shown, no edit/delete | Jordan or Alex | `offer_completed_rated` |

`04-browse.md` defines the public catalog: `Available` listings only, and a signed-in user’s own listings are omitted. Route paths stay in `04`. This table points at seed rows that fill those screens.

## Acceptance criteria

### 07-AC1: Three demo users and shared password

- **Given** a freshly seeded dev database
- **When** the three catalog users are loaded and `DemoPass1` is checked with bcrypt
- **Then** emails, display names, and cities match 07-R4, each `passwordHash` matches `DemoPass1`, and no plaintext password or reset token is stored
- **Verifies:** 07-R4, 07-R5, 07-R16

### 07-AC2: Categories

- **Given** a freshly seeded dev database
- **When** `Category` rows are listed
- **Then** the four ids, names, and slugs in 07-R3 are present and slug is unique
- **Verifies:** 07-R3

### 07-AC3: Reseed replaces dev data

- **Given** the dev database already contains the catalog plus an extra user-created listing
- **When** the seed runs again
- **Then** the extra listing is gone, catalog ids match 07-R15, and `uploads/listings/` contains only the newly copied seed photos
- **Verifies:** 07-R1, 07-R2, 07-R15

### 07-AC4: Photos copied from fixtures

- **Given** committed files in `prisma/seed-assets/` and an empty `uploads/listings/`
- **When** the seed runs
- **Then** every listing has 1–3 `ListingPhoto` rows, Charizard has two, paths match `listings/{listingId}/{photoId}.jpg`, and those files exist under `uploads/`
- **Verifies:** 07-R6

### 07-AC5: Every offer status

- **Given** the seeded `TradeOffer` rows
- **When** statuses are counted
- **Then** each of `Pending`, `Accepted`, `Declined`, `Cancelled`, and `Completed` occurs at least once, using the ids in the offer table
- **Verifies:** 07-R8

### 07-AC6: Cancel reasons and conflict snapshot

- **Given** the seeded offers
- **When** cancelled rows and `listing_sam_figure` are inspected
- **Then** `offer_cancelled_proposer` has `cancelledBy = PROPOSER`, `offer_cancelled_system` has `cancelledBy = SYSTEM` and the same target as `offer_accepted_open`, `listing_alex_loose_cards` is `Available`, and every non-cancelled offer has `cancelledBy` null
- **Verifies:** 07-R9

### 07-AC7: Accepted receipt shapes

- **Given** the two `Accepted` offers
- **When** received timestamps and listing statuses are read
- **Then** `offer_accepted_open` has both timestamps null, `offer_accepted_partial` has only `proposerReceivedAt` set, both stay `Accepted`, and `listing_sam_figure`, `listing_jordan_figure`, `listing_alex_figure`, and `listing_sam_card` are `InTrade`
- **Verifies:** 07-R10, 07-R13

### 07-AC8: Completed trades and ratings

- **Given** the two `Completed` offers
- **When** timestamps, listings, and `Rating` rows are read
- **Then** both offers have both received timestamps, their four involved listings are `Traded`, `offer_completed_rated` has the two catalog ratings with comments of at most 500 characters, and `offer_completed_unrated` has zero ratings
- **Verifies:** 07-R11, 07-R7

### 07-AC9: Offer shape and the single Pending pair

- **Given** the seeded offers and items
- **When** they are checked against 05-R2, 05-R3, 05-R4, and 05-R6
- **Then** each offer matches the catalog (including two items on `offer_pending`), `receiverId` is the target owner, and no second `Pending` offer exists for Alex and `listing_jordan_morgan`
- **Verifies:** 07-R12

### 07-AC10: Listing status and demo coverage

- **Given** the seeded listings
- **When** status, category, lock inputs, and optional fields are inspected
- **Then** statuses match the listing table and 07-R13, each category has an `Available` listing, each user has an `Available` listing that is not on `offer_pending`, and the null / present cases in 07-R14 exist (including Sam’s null `city` and a `Fair` `conditionNotes` value)
- **Verifies:** 07-R7, 07-R13, 07-R14

### 07-AC11: Public catalog is Available only

- **Given** the seeded listings
- **When** a guest catalog is taken as listings with `status = Available`, and Alex’s My listings is taken as listings owned by `user_alex`
- **Then** the guest catalog includes no `InTrade` or `Traded` id (including `listing_alex_figure` and `listing_alex_coin`); a catalog for signed-in Alex also omits Alex’s own listings; each category still has an `Available` listing in the guest catalog; Alex’s My listings includes `Available`, `InTrade`, and `Traded` rows; `listing_alex_charizard.estimatedValueCents` is `12000`; and every seeded `title`, `description`, `lookingFor`, `conditionNotes`, and rating `comment` is within the 07-R17 limits
- **Verifies:** 07-R7, 07-R17

## Edge cases and error handling

- Missing fixture file: the seed fails and does not leave a listing without its 1–3 photos.
- Running the seed against the integration-test SQLite file is out of contract; integration tests use their own database file (`00-architecture.md`).
- Reseed deletes dev-only listings, offers, and `uploads/listings/` files. That is intentional so the demo is repeatable.
- bcrypt hashes may differ across runs; login with `DemoPass1` must still succeed.
- Inserting `Accepted`, `Cancelled`, and `Completed` rows directly is allowed in the seed. Those same transitions remain domain-enforced for Server Actions (`05`, `06`).
- `listing_jordan_extra_card`, `listing_sam_batman`, `listing_sam_buffalo`, and `listing_sam_loose_figure` are on no offer. They exist so browse and a live propose still have free `Available` items after the scripted offers.
- Seed rating comments are under 500 characters: `Smooth swap, item as described.` and `Packed carefully and matched the photos.`

## Open questions

None.
