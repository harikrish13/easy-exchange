import { z } from "zod";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter an email.")
    .refine((value) => emailPattern.test(value), "Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  displayName: z.string().trim().min(1, "Display name is required."),
  city: z.string(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
