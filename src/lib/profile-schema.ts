import { z } from "zod";

import { DECORATION_STYLE_OPTIONS, EVENT_TYPE_OPTIONS } from "@/lib/decorator-taxonomy";

function taxonomyArray(allowed: readonly string[], fieldName: string) {
  return z
    .array(z.string())
    .default([])
    .refine((values) => values.every((value) => allowed.includes(value)), {
      message: `Invalid ${fieldName} value`,
    });
}

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value === "" ? null : (value ?? null)));

const optionalEmail = z
  .union([z.string().trim().email("Enter a valid email address"), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

export const profileBodySchema = z
  .object({
    company_name: z.string().trim().min(1, "Company name is required"),
    city: z.string().trim().min(1, "City is required"),
    description: optionalText,
    profile_photo_url: optionalText,
    instagram_url: optionalText,
    contact_email: optionalEmail,
    contact_phone: optionalText,
    event_types: taxonomyArray(EVENT_TYPE_OPTIONS, "event_types"),
    decoration_styles: taxonomyArray(DECORATION_STYLE_OPTIONS, "decoration_styles"),
    is_published: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.is_published) {
      return;
    }

    if (!data.description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "Description is required to publish",
      });
    }

    if (!data.contact_email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact_email"],
        message: "Contact email is required to publish",
      });
    }
  });

export type ProfileBody = z.infer<typeof profileBodySchema>;

export function parseProfileBody(input: unknown) {
  return profileBodySchema.safeParse(input);
}
