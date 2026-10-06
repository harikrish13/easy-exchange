export const DEMO_PASSWORD = "DemoPass1";

export type SeedUser = {
  id: string;
  email: string;
  displayName: string;
  city: string | null;
};

export type SeedCategory = {
  id: string;
  name: string;
  slug: string;
};

export type SeedListing = {
  id: string;
  ownerId: string;
  categoryId: string;
  title: string;
  condition: "Mint" | "NearMint" | "Excellent" | "Good" | "Fair";
  conditionNotes: string | null;
  estimatedValueCents: number | null;
  lookingFor: string | null;
  status: "Available" | "InTrade" | "Traded";
  photoIds: string[];
};

export type SeedOfferItem = {
  id: string;
  listingId: string;
};

export type SeedOffer = {
  id: string;
  proposerId: string;
  receiverId: string;
  targetListingId: string;
  status: "Pending" | "Accepted" | "Declined" | "Cancelled" | "Completed";
  cancelledBy: "PROPOSER" | "SYSTEM" | null;
  proposerReceivedAt: string | null;
  receiverReceivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: SeedOfferItem[];
};

export type SeedRating = {
  id: string;
  tradeOfferId: string;
  raterUserId: string;
  ratedUserId: string;
  score: number;
  comment: string;
  createdAt: string;
};

const FIXTURE_BY_CATEGORY: Record<string, string> = {
  cat_cards: "trading-cards.jpg",
  cat_coins: "coins.jpg",
  cat_figures: "action-figures.jpg",
  cat_comics: "comics.jpg",
};

export const users: SeedUser[] = [
  {
    id: "user_alex",
    email: "alex@demo.easyexchange.test",
    displayName: "Alex Rivera",
    city: "Portland",
  },
  {
    id: "user_jordan",
    email: "jordan@demo.easyexchange.test",
    displayName: "Jordan Lee",
    city: "Austin",
  },
  {
    id: "user_sam",
    email: "sam@demo.easyexchange.test",
    displayName: "Sam Patel",
    city: null,
  },
];

export const categories: SeedCategory[] = [
  { id: "cat_cards", name: "Trading Cards", slug: "trading-cards" },
  { id: "cat_coins", name: "Coins", slug: "coins" },
  { id: "cat_figures", name: "Action Figures", slug: "action-figures" },
  { id: "cat_comics", name: "Comics", slug: "comics" },
];

export const listings: SeedListing[] = [
  {
    id: "listing_alex_charizard",
    ownerId: "user_alex",
    categoryId: "cat_cards",
    title: "Charizard Holo",
    condition: "NearMint",
    conditionNotes: null,
    estimatedValueCents: 12000,
    lookingFor: "Vintage coins or silver-age comics",
    status: "Available",
    photoIds: ["photo_alex_charizard_1", "photo_alex_charizard_2"],
  },
  {
    id: "listing_alex_pikachu",
    ownerId: "user_alex",
    categoryId: "cat_cards",
    title: "Pikachu Promo",
    condition: "Mint",
    conditionNotes: null,
    estimatedValueCents: 4000,
    lookingFor: null,
    status: "Available",
    photoIds: ["photo_alex_pikachu_1"],
  },
  {
    id: "listing_alex_comic",
    ownerId: "user_alex",
    categoryId: "cat_comics",
    title: "Amazing Fantasy Reprint",
    condition: "Good",
    conditionNotes: null,
    estimatedValueCents: null,
    lookingFor: "Action figures",
    status: "Available",
    photoIds: ["photo_alex_comic_1"],
  },
  {
    id: "listing_alex_loose_cards",
    ownerId: "user_alex",
    categoryId: "cat_cards",
    title: "Bulk Commons Binder",
    condition: "Excellent",
    conditionNotes: null,
    estimatedValueCents: 1500,
    lookingFor: null,
    status: "Available",
    photoIds: ["photo_alex_loose_cards_1"],
  },
  {
    id: "listing_alex_gi_joe",
    ownerId: "user_alex",
    categoryId: "cat_figures",
    title: "G.I. Joe Snake Eyes",
    condition: "Good",
    conditionNotes: null,
    estimatedValueCents: 3500,
    lookingFor: "Mint coins",
    status: "Available",
    photoIds: ["photo_alex_gi_joe_1"],
  },
  {
    id: "listing_alex_figure",
    ownerId: "user_alex",
    categoryId: "cat_figures",
    title: "Vintage He-Man",
    condition: "Excellent",
    conditionNotes: null,
    estimatedValueCents: 8000,
    lookingFor: "Trading cards",
    status: "InTrade",
    photoIds: ["photo_alex_figure_1"],
  },
  {
    id: "listing_alex_coin",
    ownerId: "user_alex",
    categoryId: "cat_coins",
    title: "Walking Liberty Half",
    condition: "Fair",
    conditionNotes: "Rim nick on the reverse",
    estimatedValueCents: 2200,
    lookingFor: null,
    status: "Traded",
    photoIds: ["photo_alex_coin_1"],
  },
  {
    id: "listing_jordan_morgan",
    ownerId: "user_jordan",
    categoryId: "cat_coins",
    title: "1921 Morgan Dollar",
    condition: "Mint",
    conditionNotes: null,
    estimatedValueCents: 4500,
    lookingFor: "Holo trading cards",
    status: "Available",
    photoIds: ["photo_jordan_morgan_1"],
  },
  {
    id: "listing_jordan_penny",
    ownerId: "user_jordan",
    categoryId: "cat_coins",
    title: "1909-S VDB Lincoln Cent",
    condition: "Good",
    conditionNotes: null,
    estimatedValueCents: 9000,
    lookingFor: null,
    status: "Available",
    photoIds: ["photo_jordan_penny_1"],
  },
  {
    id: "listing_jordan_extra_card",
    ownerId: "user_jordan",
    categoryId: "cat_cards",
    title: "Baseball Rookie Lot",
    condition: "NearMint",
    conditionNotes: null,
    estimatedValueCents: 3000,
    lookingFor: "Comics",
    status: "Available",
    photoIds: ["photo_jordan_extra_card_1"],
  },
  {
    id: "listing_jordan_figure",
    ownerId: "user_jordan",
    categoryId: "cat_figures",
    title: "Star Wars Vintage Luke",
    condition: "Mint",
    conditionNotes: null,
    estimatedValueCents: 15000,
    lookingFor: "Coins",
    status: "InTrade",
    photoIds: ["photo_jordan_figure_1"],
  },
  {
    id: "listing_jordan_card",
    ownerId: "user_jordan",
    categoryId: "cat_cards",
    title: "Worn Team Set",
    condition: "Fair",
    conditionNotes: "Corners rounded",
    estimatedValueCents: 800,
    lookingFor: null,
    status: "Traded",
    photoIds: ["photo_jordan_card_1"],
  },
  {
    id: "listing_jordan_old_comic",
    ownerId: "user_jordan",
    categoryId: "cat_comics",
    title: "Detective Comics Reader Copy",
    condition: "Good",
    conditionNotes: null,
    estimatedValueCents: 1200,
    lookingFor: null,
    status: "Traded",
    photoIds: ["photo_jordan_old_comic_1"],
  },
  {
    id: "listing_sam_spawn",
    ownerId: "user_sam",
    categoryId: "cat_comics",
    title: "Spawn #1",
    condition: "Excellent",
    conditionNotes: null,
    estimatedValueCents: 6000,
    lookingFor: "Coins or cards",
    status: "Available",
    photoIds: ["photo_sam_spawn_1"],
  },
  {
    id: "listing_sam_batman",
    ownerId: "user_sam",
    categoryId: "cat_comics",
    title: "Batman Year One TPB",
    condition: "NearMint",
    conditionNotes: null,
    estimatedValueCents: null,
    lookingFor: null,
    status: "Available",
    photoIds: ["photo_sam_batman_1"],
  },
  {
    id: "listing_sam_buffalo",
    ownerId: "user_sam",
    categoryId: "cat_coins",
    title: "Buffalo Nickel",
    condition: "Good",
    conditionNotes: null,
    estimatedValueCents: 500,
    lookingFor: "Action figures",
    status: "Available",
    photoIds: ["photo_sam_buffalo_1"],
  },
  {
    id: "listing_sam_loose_figure",
    ownerId: "user_sam",
    categoryId: "cat_figures",
    title: "Loose Action Figure",
    condition: "Fair",
    conditionNotes: "Missing accessory",
    estimatedValueCents: 1000,
    lookingFor: null,
    status: "Available",
    photoIds: ["photo_sam_loose_figure_1"],
  },
  {
    id: "listing_sam_figure",
    ownerId: "user_sam",
    categoryId: "cat_figures",
    title: "MOTU Skeletor",
    condition: "Excellent",
    conditionNotes: null,
    estimatedValueCents: 7000,
    lookingFor: "Vintage figures",
    status: "InTrade",
    photoIds: ["photo_sam_figure_1"],
  },
  {
    id: "listing_sam_card",
    ownerId: "user_sam",
    categoryId: "cat_cards",
    title: "Holographic Starter",
    condition: "Mint",
    conditionNotes: null,
    estimatedValueCents: 5000,
    lookingFor: null,
    status: "InTrade",
    photoIds: ["photo_sam_card_1"],
  },
  {
    id: "listing_sam_coin",
    ownerId: "user_sam",
    categoryId: "cat_coins",
    title: "Peace Dollar",
    condition: "Excellent",
    conditionNotes: null,
    estimatedValueCents: 2800,
    lookingFor: null,
    status: "Traded",
    photoIds: ["photo_sam_coin_1"],
  },
];

export const offers: SeedOffer[] = [
  {
    id: "offer_completed_rated",
    proposerId: "user_jordan",
    receiverId: "user_alex",
    targetListingId: "listing_alex_coin",
    status: "Completed",
    cancelledBy: null,
    proposerReceivedAt: "2026-08-20T18:00:00.000Z",
    receiverReceivedAt: "2026-08-21T18:00:00.000Z",
    createdAt: "2026-08-01T18:00:00.000Z",
    updatedAt: "2026-08-21T18:00:00.000Z",
    items: [{ id: "item_completed_rated_1", listingId: "listing_jordan_card" }],
  },
  {
    id: "offer_completed_unrated",
    proposerId: "user_sam",
    receiverId: "user_jordan",
    targetListingId: "listing_jordan_old_comic",
    status: "Completed",
    cancelledBy: null,
    proposerReceivedAt: "2026-09-02T18:00:00.000Z",
    receiverReceivedAt: "2026-09-03T18:00:00.000Z",
    createdAt: "2026-08-25T18:00:00.000Z",
    updatedAt: "2026-09-03T18:00:00.000Z",
    items: [{ id: "item_completed_unrated_1", listingId: "listing_sam_coin" }],
  },
  {
    id: "offer_cancelled_system",
    proposerId: "user_alex",
    receiverId: "user_sam",
    targetListingId: "listing_sam_figure",
    status: "Cancelled",
    cancelledBy: "SYSTEM",
    proposerReceivedAt: null,
    receiverReceivedAt: null,
    createdAt: "2026-09-12T18:00:00.000Z",
    updatedAt: "2026-09-15T18:00:00.000Z",
    items: [{ id: "item_cancel_system_1", listingId: "listing_alex_loose_cards" }],
  },
  {
    id: "offer_accepted_open",
    proposerId: "user_jordan",
    receiverId: "user_sam",
    targetListingId: "listing_sam_figure",
    status: "Accepted",
    cancelledBy: null,
    proposerReceivedAt: null,
    receiverReceivedAt: null,
    createdAt: "2026-09-14T18:00:00.000Z",
    updatedAt: "2026-09-15T18:00:00.000Z",
    items: [{ id: "item_accepted_open_1", listingId: "listing_jordan_figure" }],
  },
  {
    id: "offer_declined",
    proposerId: "user_alex",
    receiverId: "user_sam",
    targetListingId: "listing_sam_spawn",
    status: "Declined",
    cancelledBy: null,
    proposerReceivedAt: null,
    receiverReceivedAt: null,
    createdAt: "2026-09-18T18:00:00.000Z",
    updatedAt: "2026-09-19T18:00:00.000Z",
    items: [{ id: "item_declined_1", listingId: "listing_alex_comic" }],
  },
  {
    id: "offer_accepted_partial",
    proposerId: "user_sam",
    receiverId: "user_alex",
    targetListingId: "listing_alex_figure",
    status: "Accepted",
    cancelledBy: null,
    proposerReceivedAt: "2026-10-01T15:00:00.000Z",
    receiverReceivedAt: null,
    createdAt: "2026-09-20T18:00:00.000Z",
    updatedAt: "2026-10-01T15:00:00.000Z",
    items: [{ id: "item_accepted_partial_1", listingId: "listing_sam_card" }],
  },
  {
    id: "offer_cancelled_proposer",
    proposerId: "user_jordan",
    receiverId: "user_alex",
    targetListingId: "listing_alex_gi_joe",
    status: "Cancelled",
    cancelledBy: "PROPOSER",
    proposerReceivedAt: null,
    receiverReceivedAt: null,
    createdAt: "2026-09-22T18:00:00.000Z",
    updatedAt: "2026-09-23T18:00:00.000Z",
    items: [{ id: "item_cancel_proposer_1", listingId: "listing_jordan_penny" }],
  },
  {
    id: "offer_pending",
    proposerId: "user_alex",
    receiverId: "user_jordan",
    targetListingId: "listing_jordan_morgan",
    status: "Pending",
    cancelledBy: null,
    proposerReceivedAt: null,
    receiverReceivedAt: null,
    createdAt: "2026-10-05T18:00:00.000Z",
    updatedAt: "2026-10-05T18:00:00.000Z",
    items: [
      { id: "item_pending_1", listingId: "listing_alex_charizard" },
      { id: "item_pending_2", listingId: "listing_alex_pikachu" },
    ],
  },
];

export const ratings: SeedRating[] = [
  {
    id: "rating_jordan_alex",
    tradeOfferId: "offer_completed_rated",
    raterUserId: "user_jordan",
    ratedUserId: "user_alex",
    score: 5,
    comment: "Smooth swap, item as described.",
    createdAt: "2026-08-22T18:00:00.000Z",
  },
  {
    id: "rating_alex_jordan",
    tradeOfferId: "offer_completed_rated",
    raterUserId: "user_alex",
    ratedUserId: "user_jordan",
    score: 4,
    comment: "Packed carefully and matched the photos.",
    createdAt: "2026-08-22T18:00:00.000Z",
  },
];

export function listingDescription(title: string): string {
  return `${title} from the Easy Exchange demo seed.`;
}

export function photoStoragePath(listingId: string, photoId: string): string {
  return `listings/${listingId}/${photoId}.jpg`;
}

export function categoryFixtureFile(categoryId: string): string {
  const fileName = FIXTURE_BY_CATEGORY[categoryId];
  if (!fileName) {
    throw new Error(`No seed fixture for category ${categoryId}`);
  }
  return fileName;
}
