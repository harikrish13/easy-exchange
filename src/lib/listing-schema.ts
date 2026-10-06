import { z } from "zod";

export const listingFormSchema = z.object({
  title: z.string(),
  categoryId: z.string(),
  condition: z.string(),
  description: z.string(),
  conditionNotes: z.string(),
  estimatedValue: z.string(),
  lookingFor: z.string(),
});

export type ListingFormInput = z.infer<typeof listingFormSchema>;
