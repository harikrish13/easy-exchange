Status: Approved

# Browse

Traces to: MVP features (Must — browse/filter); MVP features (Should — richer browse, out of scope); Core user flows (Browse); Key domain concepts and rules (Listing status)

## Purpose

This spec defines the public catalog and listing detail pages so collectors can find items to trade. The catalog lists only other people’s `Available` listings and can be filtered by category. Detail pages show the listing facts needed to decide whether to propose a trade; proposing itself is `05-trade-offers.md`.

## In scope

- Public catalog of `Available` listings, with optional category filter
- Exclude the signed-in user’s own listings from the catalog
- Listing detail for any `ListingStatus`, including direct links
- Status badge and when the “Make offer” control is shown
- Public photo reads for every listing status (via the Route Handler in `03-listings.md`)

## Out of scope

- Create, edit, delete, and “My listings” (`03-listings.md`)
- Proposing, accepting, declining, or cancelling offers (`05-trade-offers.md`)
- Condition filter and title search (Should)
- Pagination
- Wishlist (Should)

## Business rules

1. 04-R1: The catalog requires no session. It includes only listings with `status = Available`.
2. 04-R2: When a session exists, the catalog omits listings whose `ownerId` equals the session user id. Guests see every `Available` listing.
3. 04-R3: The catalog may be filtered by one existing `Category` (`id` or `slug`). No filter means all categories. An unknown category yields an empty catalog. Results are ordered by `createdAt` descending.
4. 04-R4: Listing detail requires no session and works for `Available`, `InTrade`, and `Traded`, including listings omitted from the catalog.
5. 04-R5: Detail shows `title`, category `name`, `condition` (labels: Mint, Near Mint, Excellent, Good, Fair), `conditionNotes` when set, `description`, photos in `sortOrder`, `lookingFor` when set, `estimatedValueCents` when set (fairness hint only, never a price), owner `displayName`, owner `city` when set, and a `ListingStatus` badge. Do not show `email`.
6. 04-R6: The “Make offer” control is shown only when `status = Available` and the viewer is not the owner. Guests count as not the owner and see the control; activating it requires sign-in before any propose action (`05-trade-offers.md`). The control is hidden for `InTrade`, `Traded`, and the signed-in owner’s own listing.
7. 04-R7: Any caller may load a listing’s photos through the photo Route Handler, for any `ListingStatus`. Same rule as 03-R5.

## Data involved

| Entity | Fields / notes |
|--------|----------------|
| `Listing` | `id`, `ownerId`, `title`, `description`, `condition`, `conditionNotes?`, `estimatedValueCents?`, `lookingFor?`, `status`, `createdAt` |
| `Category` | `id`, `name`, `slug` — filter and display |
| `ListingPhoto` | `sortOrder`, served by the `03` Route Handler |
| `User` | Owner `displayName`, `city?` only (no `email`) |

## User flows or API behavior

### View catalog

1. Guest or signed-in user opens the catalog, optionally with one category filter.
2. Server returns matching listings per 04-R1–04-R3 (title, category name, condition, first photo).
3. Empty match shows an empty state. Choosing a listing opens detail.

### View listing detail

1. User opens a listing by id (from the catalog or a direct link).
2. If the listing exists, render 04-R5 and the “Make offer” control per 04-R6.
3. If it does not exist, respond not-found.

### Load photo

1. Client requests a photo via the `03` Route Handler.
2. Handler returns the file for any listing status, or not-found if the row or file is missing.

## Acceptance criteria

### 04-AC1: Catalog is Available only

- **Given** listings in `Available`, `InTrade`, and `Traded`, and no session
- **When** the catalog is opened with no category filter
- **Then** only `Available` listings appear, newest `createdAt` first
- **Verifies:** 04-R1, 04-R3

### 04-AC2: Signed-in catalog hides own listings

- **Given** a signed-in user who owns an `Available` listing, and another user’s `Available` listing
- **When** they open the catalog
- **Then** their own listing is absent and the other user’s listing is present
- **Verifies:** 04-R2

### 04-AC3: Category filter

- **Given** `Available` listings in two categories
- **When** the catalog is filtered to one existing category, then to an unknown category
- **Then** the first result contains only that category, and the second result is empty
- **Verifies:** 04-R3

### 04-AC4: Detail for any status

- **Given** an `InTrade` or `Traded` listing (or the viewer’s own `Available` listing)
- **When** a guest or signed-in user opens it by direct link
- **Then** the page shows the 04-R5 fields and a status badge, and does not show `email`
- **Verifies:** 04-R4, 04-R5

### 04-AC5: Make offer visibility

- **Given** an `Available` listing owned by someone else, the same user’s own `Available` listing, and an `InTrade` listing
- **When** a guest views the first, and a signed-in owner views their own and the `InTrade` listing
- **Then** “Make offer” is shown only on the first; a guest who activates it must sign in before a propose action; it is hidden on the owner’s listing and on `InTrade`
- **Verifies:** 04-R6

### 04-AC6: Photos for every status

- **Given** photos on `Available`, `InTrade`, and `Traded` listings
- **When** any caller requests each photo through the Route Handler
- **Then** each image is returned
- **Verifies:** 04-R7

### 04-AC7: Missing listing

- **Given** an id that matches no `Listing`
- **When** detail is requested
- **Then** the response is not-found
- **Verifies:** 04-R4

## Edge cases and error handling

- Signed-in user opens their own listing by direct link: detail renders; it stays off the catalog; “Make offer” is hidden.
- `InTrade` and `Traded` listings never appear in the catalog.
- A signed-in user’s own listings, in every status, are listed on My listings (`03-listings.md`), with edit/delete only when that spec’s lock allows it. They are not added to this catalog.
- Omit `city`, `lookingFor`, `conditionNotes`, and estimated value when null.
- Missing photo file: Route Handler returns not-found (same as `03`).

## Open questions

None.
