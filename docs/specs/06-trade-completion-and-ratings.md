Status: Approved

# Trade Completion and Ratings

Traces to: MVP features (Must); Core user flows (Complete a trade); Key domain concepts and rules (Trade post-accept, Completion, Rating); Trade offer lifecycle; Won't (no cancel/dispute after Accept)

## Purpose

After a trade offer is `Accepted`, both parties confirm offline receipt so the offer becomes `Completed` and involved listings become `Traded`. Each party may then leave one optional 1–5 rating with a comment of at most 500 characters. The rating UI is on the trade offer detail page and appears only after `Completed`. A submitted rating cannot be edited or deleted. There is no cancel or dispute after Accept.

## In scope

- Mark “item received” for proposer and receiver on an `Accepted` offer
- Auto-complete when both received timestamps are set
- Set involved listings to `Traded` on complete (keep rows; never hard-delete)
- Optional post-complete rating (score + optional comment, max 500 characters) per party
- Rating UI on the trade offer detail page, shown only when the offer is `Completed`
- Ratings are immutable after submit
- Domain transitions in `src/domain`; mutations via Server Actions (per `00-architecture.md`)

## Out of scope

- Cancel, dispute, or reopen after `Accepted` (Won't)
- Shipping tracking, escrow, chat (Won't)
- Profile page aggregating ratings/history (Should)
- Offer accept/decline/conflict cancel (belongs in `05-trade-offers.md`)
- Editing or deleting a rating after submit (Won’t for MVP)

## Business rules

1. 06-R1: Only the `proposerId` or `receiverId` of a `TradeOffer` with `status = Accepted` may mark received; each sets only their own timestamp (`proposerReceivedAt` or `receiverReceivedAt`).
2. 06-R2: Marking received when that party’s timestamp is already set is a no-op success (idempotent); a party cannot clear or change an already-set received timestamp.
3. 06-R3: When both `proposerReceivedAt` and `receiverReceivedAt` are non-null, the offer transitions `Accepted` → `Completed` in the same operation that set the second timestamp.
4. 06-R4: On `Completed`, every involved listing (the `targetListingId` plus all `TradeOfferItem.listingId` rows) becomes `ListingStatus.Traded` and is retained (never hard-deleted). Aligns with 01-R11, 01-R14.
5. 06-R5: No cancel, decline, dispute, or reopen is allowed once status is `Accepted` or `Completed`.
6. 06-R6: A `Rating` may be created only when the offer is `Completed`; only the proposer or receiver may rate; each may create at most one rating per offer (`@@unique([tradeOfferId, raterUserId])` per 01-R12).
7. 06-R7: `score` is required integer 1–5; `comment` is an optional string of at most 500 characters; `raterUserId` ≠ `ratedUserId`; `ratedUserId` is the other party on that offer. A comment longer than 500 characters is rejected and no `Rating` row is stored. A blank comment is stored as null.
8. 06-R8: Rating is optional; completion does not require either party to rate.
9. 06-R9: A rating cannot be edited or deleted once submitted. Create-once is final for MVP. There is no update or delete action for `Rating`.
10. 06-R10: Rating UI lives on the trade offer detail page and is shown only when that offer’s `status` is `Completed`. It is not shown for `Pending`, `Accepted`, `Declined`, or `Cancelled`. After `Completed`, the page shows ratings already submitted for that offer. A party who has not rated sees a form (score 1–5 and optional comment). A party who has rated does not see edit or delete controls.

## Data involved

| Entity | Fields / notes |
|--------|----------------|
| `TradeOffer` | `status` (`Accepted` → `Completed`); `proposerReceivedAt`; `receiverReceivedAt`; `proposerId`; `receiverId`; `targetListingId`; `items` |
| `Listing` | Involved rows → `status = Traded` on complete |
| `Rating` | `tradeOfferId`, `raterUserId`, `ratedUserId`, `score` (1–5), `comment?` (≤500 characters); unique `(tradeOfferId, raterUserId)`; no update or delete |

Field names match `01-data-model.md` exactly. No separate `Trade` table.

## User flows or API behavior

### Mark item received

1. Authenticated proposer or receiver opens an `Accepted` trade they belong to.
2. Caller invokes a Server Action with the offer id (Zod-validated).
3. Domain sets that party’s received timestamp if null; if both timestamps are set, sets `status = Completed` and marks all involved listings `Traded`.
4. Returns success or a typed domain/auth error.

### Leave rating (optional)

1. A party opens the trade offer detail page. The rating UI is rendered only when `status = Completed` (06-R10).
2. If that party has not rated, they may submit score 1–5 and an optional comment of at most 500 characters, once.
3. Server Action validates input, confirms caller is a party and offer is `Completed`, sets `ratedUserId` to the other party, persists `Rating`.
4. A second rating, or an edit or delete of the submitted rating, is rejected. The stored score and comment stay as submitted.

## Acceptance criteria

### 06-AC1: First party marks received

- **Given** an `Accepted` offer with both received timestamps null
- **When** the proposer marks received
- **Then** `proposerReceivedAt` is set, status stays `Accepted`, listings stay `InTrade`
- **Verifies:** 06-R1

### 06-AC2: Second mark completes trade

- **Given** an `Accepted` offer with exactly one received timestamp set
- **When** the other party marks received
- **Then** both timestamps are set, status is `Completed`, and target plus offered listings are `Traded` (rows retained)
- **Verifies:** 06-R3, 06-R4

### 06-AC3: Idempotent mark

- **Given** a party who already marked received
- **When** they mark received again
- **Then** the operation succeeds without clearing or changing timestamps or status incorrectly
- **Verifies:** 06-R2

### 06-AC4: No post-accept cancel

- **Given** an `Accepted` or `Completed` offer
- **When** any cancel/dispute/reopen is attempted
- **Then** the operation is rejected
- **Verifies:** 06-R5

### 06-AC5: Rating after complete only

- **Given** an offer that is not `Completed`
- **When** a party tries to create a rating
- **Then** the operation is rejected
- **Verifies:** 06-R6

### 06-AC6: One rating per party

- **Given** a `Completed` offer and a party who already rated
- **When** they submit another rating
- **Then** the operation is rejected; score is 1–5; optional comment is at most 500 characters; `ratedUserId` is the other party
- **Verifies:** 06-R6, 06-R7, 06-R8

### 06-AC7: Non-party forbidden

- **Given** an `Accepted`/`Completed` offer
- **When** a user who is neither proposer nor receiver marks received or rates
- **Then** the operation is rejected
- **Verifies:** 06-R1, 06-R6

### 06-AC8: Rating UI only after Completed

- **Given** a party on the trade offer detail page for an offer that is not `Completed`, and the same page after that offer is `Completed`
- **When** they view the page in each case, and they have not yet rated in the `Completed` case
- **Then** no rating form or submitted ratings are shown before `Completed`, and after `Completed` the form is shown
- **Verifies:** 06-R10

### 06-AC9: Rating cannot be edited or deleted

- **Given** a party who already submitted a rating on a `Completed` offer
- **When** they try to edit or delete it
- **Then** the operation is rejected and the stored score and comment are unchanged; the detail page shows the submitted rating without edit or delete controls
- **Verifies:** 06-R9, 06-R10

### 06-AC10: Comment max length

- **Given** a `Completed` offer and a party who has not rated
- **When** they submit a comment longer than 500 characters
- **Then** the rating is rejected and no `Rating` row is created
- **Verifies:** 06-R7

## Edge cases and error handling

- Unauthenticated caller: structured auth error; no mutation (00-R8).
- Stall risk: if one party never marks received, offer stays `Accepted` / listings `InTrade` forever (accepted plan risk; no dispute).
- Involved listings on complete are exactly `targetListingId` ∪ `TradeOfferItem.listingId` for that offer.
- Self-rating (`raterUserId === ratedUserId`) is rejected even if somehow posted.
- Blank comment is stored as null. A comment of exactly 500 characters is accepted.

## Open questions

- [x] Decided: the "Mark received" control is on the trade offer detail page, shown to each party only while the offer is `Accepted` and that party has not yet marked received. Rating UI is decided in 06-R10.
