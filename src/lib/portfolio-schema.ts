import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value === "" ? null : (value ?? null)));

export const portfolioEntryBodySchema = z.object({
  storage_path: z.string().trim().min(1),
  event_description: optionalText,
  decoration_style: optionalText,
  location: optionalText,
  tags: z
    .array(z.string().trim().min(1))
    .default([])
    .transform((tags) => tags.map((tag) => tag.trim()).filter(Boolean)),
});

export type PortfolioEntryBody = z.infer<typeof portfolioEntryBodySchema>;

export function parsePortfolioEntryBody(input: unknown) {
  return portfolioEntryBodySchema.safeParse(input);
}
