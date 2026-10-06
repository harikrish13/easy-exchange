import { z } from "zod";

export const proposeSchema = z.object({
  targetListingId: z.string().min(1, "Choose an item to ask for."),
  offeredListingIds: z
    .array(z.string().min(1))
    .min(1, "Choose 1 to 3 of your available items.")
    .max(3, "Choose 1 to 3 of your available items."),
});

export type ProposeInput = z.infer<typeof proposeSchema>;

export const tradeOfferIdSchema = z.object({
  tradeOfferId: z.string().min(1, "Choose an offer."),
});

export type TradeOfferIdInput = z.infer<typeof tradeOfferIdSchema>;

export const ratingSchema = z.object({
  tradeOfferId: z.string().min(1, "Choose an offer."),
  score: z.coerce
    .number()
    .int("Choose a rating from 1 to 5.")
    .min(1, "Choose a rating from 1 to 5.")
    .max(5, "Choose a rating from 1 to 5."),
  comment: z.string().max(500, "Comment must be 500 characters or fewer."),
});

export type RatingInput = z.infer<typeof ratingSchema>;
