Status: Approved

# Listings

Traces to: MVP features (Must — listings, photos); Core user flows (List an item); Key domain concepts and rules (Category, Condition, Listing status, Photos, Edit/delete lock); Risks and decided constraints (photos)

## Purpose

This spec defines how signed-in users create, edit, and delete their collectible listings, including photo upload, the edit/delete lock, and the “My listings” page. It uses entity and field names from `01-data-model.md` and the Server Action / filesystem photo approach from `00-architecture.md`. Browse/filter of others’ listings is out of scope (`04-browse.md`).

## In scope

- Create listing (required + optional fields, 1–3 photos)
- “My listings” for the signed-in owner: every own listing, any status
- Edit allowed fields and delete own listings when unlocked
- Photo validation and storage under `uploads/` at create; serving via Route Handler for any listing status
- Edit/delete lock when a listing is in a Pending offer or an Accepted trade

## Out of scope

- Browse/filter catalog (`04-browse.md`); the public catalog is `Available` only and omits the viewer’s own listings
- Changing photos on edit (Won’t for MVP); photos are set at creation only
- Trade offers, status transitions to `InTrade` / `Traded` (`05` / `06`)
- Wishlist (Should)
- Seed listing content (`07-seed-data.md`)

## Business rules

1. 03-R1: Only an authenticated user may create, edit, or delete listings; the creator is always `ownerId` = session user id (never taken from client as another user).
2. 03-R2: Creating a listing requires `title`, `categoryId` (existing `Category` row), `condition` (`Mint` | `NearMint` | `Excellent` | `Good` | `Fair`), `description`, and 1–3 photos; optional `conditionNotes`, estimated value, and `lookingFor`. String limits are 03-R10. Estimated value input is 03-R8. New listings start with `status = Available`.
3. 03-R3: Each photo must be JPEG or PNG (`image/jpeg` or `image/png`) and at most 5 MB; reject invalid files before persisting the listing or writing other photos for that request.
4. 03-R4: Photo files are stored under `uploads/listings/{listingId}/{photoId}.jpg` or `.png` (extension matches mime); `ListingPhoto.storagePath` is the path relative to `uploads/` (for example `listings/{listingId}/{photoId}.jpg`). `sortOrder` is 0-based in upload order.
5. 03-R5: Photos are served only via a Route Handler (not `public/`). Any caller may read photos for a listing in any status (`Available`, `InTrade`, or `Traded`). Same rule as 04-R7.
6. 03-R6: A listing is **locked** (cannot be edited or deleted) if it appears in any `TradeOffer` with `status = Pending` (as `targetListingId` or via `TradeOfferItem`) or if its `status` is `InTrade` or `Traded`. Only the owner may edit/delete when unlocked. Edit and delete controls are shown only when the listing is unlocked.
7. 03-R7: Unlocked edit may change title, category, condition, description, and optional fields (`conditionNotes`, estimated value, `lookingFor`). Photos are set at creation only; changing, adding, or removing photos on edit is Won’t for MVP. A request that tries to change the photo set is rejected and the listing is unchanged. Unlocked delete hard-deletes the `Listing`, its `ListingPhoto` rows, and the corresponding files under `uploads/`.
8. 03-R8: The user enters estimated value as a dollar amount with at most 2 decimal places, or leaves it blank. The server stores `estimatedValueCents` as a nullable integer number of cents (`12` → `1200`, `12.5` or `12.50` → `1250`). Blank stores null. Reject negative values, non-numeric values, and values with more than 2 decimal places. It is a fairness hint only and must never be treated as a payment amount in copy or logic.
9. 03-R9: Listing create/update/delete use Server Actions with Zod validation; listing status transitions to `InTrade` / `Traded` are not performed by this feature (domain rules live with trade specs).
10. 03-R10: Maximum lengths in characters: `title` 100, `description` 2000, `lookingFor` 300, `conditionNotes` 300. Longer values are rejected on create and on edit. Omitted or blank optional strings are stored null.
11. 03-R11: “My listings” requires a session. It lists every listing whose `ownerId` is the session user, in every status (`Available`, `InTrade`, and `Traded`). Edit and delete are shown only for unlocked listings (03-R6). It does not list other users’ listings. Unauthenticated callers receive a structured auth error and see no listings (03-R1).

## Data involved

| Entity | Fields / notes |
|--------|----------------|
| `Listing` | Per `01-data-model.md`: `ownerId`, `categoryId`, `title` (≤100), `description` (≤2000), `condition`, `conditionNotes?` (≤300), `estimatedValueCents?` (integer cents from a dollar input), `lookingFor?` (≤300), `status` |
| `ListingPhoto` | `listingId`, `storagePath`, `sortOrder`, `mimeType` |
| `Category` | Must exist; listings reference `categoryId` (seeded rows) |
| `TradeOffer` / `TradeOfferItem` | Used only to evaluate the edit/delete lock (03-R6) |

## User flows or API behavior

### Create listing

1. Signed-in user submits listing fields + 1–3 image files.
2. Server Action: session check → Zod validate fields (03-R10), dollar estimated value (03-R8), and photo count/type/size → create `Listing` (`Available`) → write files → create `ListingPhoto` rows (or roll back listing + files on failure so no partial photo set remains).
3. Return success with listing id, or a typed/user-safe error.

### Edit listing

1. Owner submits field updates for an unlocked listing. Photos are not part of edit.
2. Server Action: session + ownership → lock check (03-R6) → Zod validate fields and estimated value → update the row. Existing `ListingPhoto` rows and files stay as they were.
3. Reject with a lock error if the listing is locked. Reject a request that includes a photo-set change; do not write or delete photo files.

### My listings

1. Signed-in user opens My listings.
2. Server returns every listing owned by that user, any status.
3. The page shows edit and delete only on unlocked listings (03-R6).
4. No session: structured auth error; no listings are shown.

### Delete listing

1. Owner requests delete on an unlocked listing.
2. Server Action: session + ownership → lock check → delete DB rows and files.
3. Reject if locked.

### Serve photo

1. Client requests photo via Route Handler (by photo id or path agreed in implementation).
2. Handler applies 03-R5; streams file from `uploads/` or returns not-found / forbidden.

## Acceptance criteria

### 03-AC1: Create with photos

- **Given** a signed-in user and a valid category id
- **When** they create a listing with required fields and 2 JPEG photos under 5 MB
- **Then** a `Listing` exists with `status = Available`, `ownerId` = that user, and 2 `ListingPhoto` rows with files under `uploads/listings/{listingId}/`
- **Verifies:** 03-R1, 03-R2, 03-R4

### 03-AC2: Reject bad photos

- **Given** a signed-in user creating a listing
- **When** they upload a non-JPEG/PNG file, a file over 5 MB, or 0 / 4+ photos
- **Then** the action fails, no listing row is left without a valid 1–3 photo set, and no orphan upload files remain for that attempt
- **Verifies:** 03-R3

### 03-AC3: Unauthenticated create blocked

- **Given** no valid session
- **When** create/edit/delete or My listings is invoked
- **Then** a structured auth error is returned, no mutation occurs, and no listings are shown
- **Verifies:** 03-R1, 03-R9, 03-R11

### 03-AC4: Edit/delete when unlocked

- **Given** an `Available` listing owned by the user that is not in any Pending offer
- **When** the owner edits fields or deletes the listing
- **Then** the field update persists and the photo set is unchanged, or on delete the listing, photo rows, and files are removed
- **Verifies:** 03-R6, 03-R7

### 03-AC5: Lock while Pending or InTrade/Traded

- **Given** a listing that is a target or offered item on a Pending offer, or has `status` `InTrade` or `Traded`
- **When** the owner attempts edit or delete
- **Then** the action is rejected and the listing is unchanged
- **Verifies:** 03-R6

### 03-AC6: Photos readable in any status

- **Given** photos on listings with status `Available`, `InTrade`, and `Traded`
- **When** any caller, including a guest or a non-owner, requests each photo through the Route Handler
- **Then** each image is returned, and files are not exposed via `public/`
- **Verifies:** 03-R5, 03-R4

### 03-AC7: My listings shows every own status

- **Given** a signed-in user who owns an unlocked `Available` listing, an `Available` listing locked by a Pending offer, an `InTrade` listing, and a `Traded` listing
- **When** they open My listings
- **Then** all four listings are listed, and edit/delete controls are shown only on the unlocked listing
- **Verifies:** 03-R6, 03-R11

### 03-AC8: Field length limits

- **Given** a signed-in user creating or editing a listing
- **When** `title` exceeds 100 characters, `description` exceeds 2000, `lookingFor` exceeds 300, or `conditionNotes` exceeds 300
- **Then** the action is rejected and the over-limit value is not stored
- **Verifies:** 03-R10

### 03-AC9: Estimated value dollars to cents

- **Given** a signed-in user creating or editing an unlocked listing
- **When** they enter `12.5` dollars, leave the value blank, or enter `-1` or `12.345`
- **Then** `12.5` is stored as `estimatedValueCents = 1250`, blank is stored as null, and the negative and 3-decimal values are rejected
- **Verifies:** 03-R8

### 03-AC10: Edit cannot change photos

- **Given** an unlocked listing with a photo set
- **When** the owner updates allowed fields, and when a request tries to add, remove, or replace photos
- **Then** the field update leaves `ListingPhoto` rows and files unchanged, and the photo-change request is rejected with the existing photo set still in place
- **Verifies:** 03-R7

## Edge cases and error handling

- Invalid `categoryId`: reject create/edit; do not write photos.
- Partial upload failure mid-create: delete any files already written for that attempt and do not leave a listing with 0 photos.
- Missing file on disk for a stored `storagePath`: Route Handler returns not-found.
- Non-owner edit/delete, or opening another user’s My listings: reject (authz error).
- Concurrent accept that locks a listing during an edit: lock check must run so the edit fails rather than mutating a now-locked listing.
- Whole-dollar entry (`12`) stores `1200` cents. `12.50` stores `1250`.

## Open questions

None.
