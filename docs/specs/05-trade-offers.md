Status: Approved

# Trade Offers

Traces to: MVP features (Must); Core user flows (Propose a trade, Respond to an offer); Key domain concepts and rules (TradeOffer, Pending uniqueness, Offer statuses, Conflict rule); Trade offer lifecycle (detail); Won't (in-app counter-offers, multi-item asks)

## Purpose

This spec defines how users propose, accept, decline, and cancel trade offers, and how accepting an offer locks involved listings and auto-cancels conflicting pending offers. It covers the `Pending` → `Accepted` | `Declined` | `Cancelled` transitions only; marking items received and ratings belong in `06-trade-completion-and-ratings.md`. Domain transition and conflict-cancel logic live in `src/domain` per `00-architecture.md`.

## In scope

- Propose a trade: 1–3 of the proposer’s `Available` listings for exactly one target listing owned by another user
- Pending uniqueness: at most one `Pending` `TradeOffer` per `(proposerId, targetListingId)`
- Receiver accept and decline while `Pending`
- Proposer cancel while `Pending` (`cancelledBy = PROPOSER`)
- On accept: involved listings → `InTrade`; conflicting other `Pending` offers → `Cancelled` with `cancelledBy = SYSTEM`
- Offer history visibility for declined and cancelled offers (both parties)
- Server Actions + Zod validation for propose / accept / decline / cancel; domain functions for transitions and conflict cancel

## Out of scope

- Marking “item received”, `Completed`, listings → `Traded`, and ratings (`06-trade-completion-and-ratings.md`)
- Counter-offers (Won’t)
- Multi-item asks on the receiver side (Won’t; target is always exactly one listing)
- Chat / messaging about an offer (Won’t)
- Cancelling or disputing after `Accepted` (Won’t)
- Listing create/edit/delete and the edit/delete lock when a listing is in a Pending or Accepted offer (`03-listings.md`)
- Browse UI for finding listings (`04-browse.md`)
- Seeded sample offers (`07-seed-data.md`)
- In-app notifications when the system auto-cancels an offer (history is enough for MVP)

## Business rules

1. 05-R1: Only an authenticated user may propose, accept, decline, or cancel a trade offer. Unauthenticated callers receive a structured auth error and no mutation occurs (`00-R8`).
2. 05-R2: A proposer cannot create an offer whose `targetListingId` is owned by themselves (`ownerId === proposerId`). “No offers on your own listing.”
3. 05-R3: Each new offer targets exactly one listing (`targetListingId`). The client never supplies `receiverId`; the server sets `receiverId` to that listing’s `ownerId` (`01-data-model.md`).
4. 05-R4: Each new offer includes 1–3 distinct offered listings via `TradeOfferItem` rows. Every offered listing must be owned by the proposer, have `status = Available`, and must not be the target listing.
5. 05-R5: The target listing must exist and have `status = Available` at propose time.
6. 05-R6: At most one `TradeOffer` with `status = Pending` may exist for a given `(proposerId, targetListingId)`. A second concurrent Pending propose for that pair is rejected. After an offer leaves `Pending` (`Accepted`, `Declined`, or `Cancelled`), the proposer may create a new Pending offer for the same target.
7. 05-R7: The same proposer’s offered listing may appear in multiple concurrent `Pending` offers to different targets until one of those offers is accepted (conflict cancel then applies).
8. 05-R8: A new offer is created with `status = Pending` and `cancelledBy = null`. `proposerReceivedAt` and `receiverReceivedAt` remain null.
9. 05-R9: From `Pending`, allowed transitions are only: receiver → `Declined`; proposer → `Cancelled` with `cancelledBy = PROPOSER`; receiver → `Accepted`; system (on another accept) → `Cancelled` with `cancelledBy = SYSTEM`. No other transitions are allowed in this spec.
10. 05-R10: Only the `receiverId` user may accept or decline a `Pending` offer. Only the `proposerId` user may cancel a `Pending` offer. Wrong actor → reject; no state change.
11. 05-R11: Decline sets `status = Declined` and leaves `cancelledBy` null. Involved listings remain `Available`.
12. 05-R12: Proposer cancel sets `status = Cancelled` and `cancelledBy = PROPOSER`. Involved listings remain `Available`.
13. 05-R13: Accept is atomic. On success: the offer’s `status` becomes `Accepted`; every involved listing (the target listing plus all offered listings) moves from `Available` to `InTrade`. If any involved listing is not `Available` at accept time, accept is rejected and nothing is persisted from that attempt.
14. 05-R14: Conflict auto-cancel (runs in the same accept transaction): any other `TradeOffer` with `status = Pending` that includes any involved listing—as its `targetListingId` or as a `TradeOfferItem.listingId`—is set to `status = Cancelled` and `cancelledBy = SYSTEM`. The accepted offer itself is not cancelled.
15. 05-R15: `cancelledBy` is null unless `status` is `Cancelled`. When `Cancelled`, `cancelledBy` is exactly `PROPOSER` or `SYSTEM` as above (`01-R8`).
16. 05-R16: Declined and cancelled offers are retained and remain visible in each party’s offer history (proposer and receiver). They are not hard-deleted.
17. 05-R17: There are no counter-offers: a decline or cancel does not create a reverse offer; the other party must propose a new offer if they still want to trade.
18. 05-R18: Propose, accept, decline, and cancel are Server Actions that validate input with Zod, then apply rules in `src/domain` (no Prisma/Next imports in domain), then persist via `src/server` data access (`00-R3`–`00-R6`). Conflict auto-cancel logic is domain-owned.

## Data involved

| Entity | Fields / notes |
|--------|----------------|
| `TradeOffer` | `id`, `proposerId`, `receiverId`, `targetListingId`, `status`, `cancelledBy`, `proposerReceivedAt`, `receiverReceivedAt`, timestamps — field meanings per `01-data-model.md`. This spec writes `Pending` / `Accepted` / `Declined` / `Cancelled` and `cancelledBy`; it does not set received timestamps or `Completed`. |
| `TradeOfferItem` | `tradeOfferId` + `listingId`; 1–3 rows per offer; unique `(tradeOfferId, listingId)`. |
| `Listing` | `ownerId`, `status` (`Available` → `InTrade` on accept for involved listings). |
| `User` | Session user id as proposer/receiver actor; `displayName` / `city` for history UI only. |
| `CancelledBy` | `PROPOSER` \| `SYSTEM` — used only when `status = Cancelled`. |

## User flows or API behavior

### Propose trade

1. Signed-in user opens another user’s `Available` listing (not their own).
2. Client submits `targetListingId` and 1–3 of the proposer’s own `Available` listing ids.
3. Server Action: Zod parse → session required → load target and offered listings → domain validates 05-R2–05-R6 → persist `TradeOffer` (`Pending`, `cancelledBy` null, `receiverId` from target owner) + `TradeOfferItem` rows → return success or typed error.

### Receiver: list pending offers

1. Signed-in receiver opens their incoming offers view.
2. Server loads `TradeOffer` rows where `receiverId` is the current user (at least `Pending`; history may include other statuses).
3. UI shows target listing, offered items, proposer display identity, and Accept / Decline for `Pending` rows.

### Accept offer

1. Receiver invokes accept with `tradeOfferId`.
2. Server Action: session must be `receiverId`; offer must be `Pending`; all involved listings must be `Available`.
3. Domain applies accept + conflict auto-cancel (05-R13, 05-R14) in one transaction:
   - Accepted offer → `Accepted`
   - Involved listings → `InTrade`
   - Conflicting other Pending offers → `Cancelled`, `cancelledBy = SYSTEM`
4. Return success or typed error. Completion/received flags are not set here.

### Decline offer

1. Receiver invokes decline with `tradeOfferId`.
2. Server Action: session must be `receiverId`; offer must be `Pending`.
3. Domain sets `status = Declined`, `cancelledBy` unchanged (null). Listings stay `Available`.

### Proposer cancel

1. Proposer invokes cancel with `tradeOfferId`.
2. Server Action: session must be `proposerId`; offer must be `Pending`.
3. Domain sets `status = Cancelled`, `cancelledBy = PROPOSER`. Listings stay `Available`.

### Offer history

1. Each party can view their proposed and received offers including `Declined` and `Cancelled` (with `cancelledBy` distinguishing proposer vs system cancel).
2. History is read-only for non-`Pending` rows in this spec (no reopen; no post-accept cancel).

## Acceptance criteria

### 05-AC1: No offer on own listing

- **Given** a signed-in user who owns listing T (`Available`)
- **When** they attempt to propose a trade with `targetListingId = T`
- **Then** the action is rejected with a typed domain/auth-safe error, and no `TradeOffer` row is created
- **Verifies:** 05-R2

### 05-AC2: Valid propose shape

- **Given** user A (not owner of target T), T is `Available`, and A owns 1–3 distinct `Available` listings O1…On (none equal to T)
- **When** A proposes those offered listings for T
- **Then** a `TradeOffer` is created with `status = Pending`, `cancelledBy = null`, `proposerId = A`, `receiverId = T.ownerId`, `targetListingId = T`, and matching `TradeOfferItem` rows
- **Verifies:** 05-R3, 05-R4, 05-R5, 05-R8

### 05-AC3: Reject invalid offered items

- **Given** a propose attempt where an offered listing is not owned by the proposer, is not `Available`, duplicates another offered id, is the target itself, or the offered count is not in 1–3
- **When** propose runs
- **Then** the action is rejected and no offer is persisted
- **Verifies:** 05-R4

### 05-AC4: One Pending per proposer per target

- **Given** proposer A already has a `Pending` offer for target listing T
- **When** A attempts another propose for the same T
- **Then** the second propose is rejected and the existing Pending offer is unchanged
- **Verifies:** 05-R6

### 05-AC5: Re-propose after non-Pending

- **Given** proposer A’s prior offer for T is `Declined` or `Cancelled` (not `Pending`)
- **When** A proposes again for T with valid offered items
- **Then** a new `Pending` offer is created
- **Verifies:** 05-R6

### 05-AC6: Receiver decline

- **Given** a `Pending` offer from A to B
- **When** B declines
- **Then** `status = Declined`, `cancelledBy` is null, and all involved listings remain `Available`
- **Verifies:** 05-R9, 05-R10, 05-R11

### 05-AC7: Proposer cancel

- **Given** a `Pending` offer from A to B
- **When** A cancels
- **Then** `status = Cancelled`, `cancelledBy = PROPOSER`, and involved listings remain `Available`
- **Verifies:** 05-R9, 05-R10, 05-R12, 05-R15

### 05-AC8: Wrong actor rejected

- **Given** a `Pending` offer from A to B
- **When** A tries to accept or decline, or B tries to cancel, or any third user tries any of those actions
- **Then** the action is rejected and the offer stays `Pending`
- **Verifies:** 05-R10

### 05-AC9: Accept moves listings to InTrade

- **Given** a `Pending` offer whose target T and offered listings O1…On are all `Available`
- **When** the receiver accepts
- **Then** the offer’s `status = Accepted`, and T and O1…On each have `status = InTrade`
- **Verifies:** 05-R13

### 05-AC10: Conflict auto-cancel with cancelledBy = SYSTEM

- **Given** accepted offer Acc involves listings {T, O1, O2}; and other `Pending` offers P2 (targets T), P3 (includes O1 as an offered item), and P4 (unrelated listings only)
- **When** Acc is accepted
- **Then** P2 and P3 become `Cancelled` with `cancelledBy = SYSTEM`; P4 remains `Pending`; Acc is `Accepted` (not cancelled)
- **Verifies:** 05-R14, 05-R15

### 05-AC11: Accept rejects if listing no longer Available

- **Given** a `Pending` offer whose target or an offered listing is already `InTrade` or `Traded`
- **When** the receiver accepts
- **Then** accept fails, the offer remains `Pending`, and no conflict cancels are applied from that attempt
- **Verifies:** 05-R13

### 05-AC12: History retains declined and cancelled

- **Given** offers that were declined, proposer-cancelled, or system-cancelled
- **When** the proposer or receiver opens offer history
- **Then** those offers are still listed (not hard-deleted), and system cancels show `cancelledBy = SYSTEM`
- **Verifies:** 05-R16

### 05-AC13: Domain owns transitions and conflict cancel

- **Given** the implementation of accept and conflict cancel
- **When** `src/domain` modules for trade offers are inspected
- **Then** transition and conflict-cancel rules are implemented there without importing `next`, Auth.js, or `@prisma/client`, and writes go through Server Actions + data access
- **Verifies:** 05-R18

### 05-AC14: Unauthenticated actions rejected

- **Given** no signed-in session
- **When** propose, accept, decline, or cancel is invoked
- **Then** a structured auth error is returned and no offer or listing is changed
- **Verifies:** 05-R1

### 05-AC15: Same offered listing in multiple Pending offers

- **Given** proposer A owns `Available` listing O1
- **When** A proposes O1 in an offer for target T1 and also in an offer for target T2
- **Then** both offers are created as `Pending`
- **Verifies:** 05-R7

### 05-AC16: Decline or cancel creates no counter-offer

- **Given** a `Pending` offer from A to B
- **When** B declines it, or A cancels it
- **Then** no new `TradeOffer` is created in either direction
- **Verifies:** 05-R17

## Edge cases and error handling

- Propose against a missing or non-`Available` target → reject; no partial offer rows.
- Concurrent double-accept on overlapping listings: only one accept may succeed; the other must fail 05-AC11-style (use a single DB transaction for accept + listing updates + conflict cancels).
- Accept/decline/cancel on a non-`Pending` offer → reject; no reopen.
- Empty offered list, more than 3 offered listings, or duplicate offered ids → Zod/domain reject before persist.
- System-cancelled offers appear in history only; MVP does not send notifications.
- `estimatedValueCents` on listings is display-only fairness context; it does not gate propose or accept.
- Edit/delete of listings locked by Pending/Accepted offers is enforced in `03-listings.md`, not by deleting offers here.

## Open questions

- [ ] Exact App Router paths for “incoming offers” and “offer history” pages (implementation detail; behavior above is required regardless of path names).
- [ ] Confirm transaction isolation approach for accept + conflict cancel (must be atomic; exact Prisma interactive-transaction settings chosen at implementation).
