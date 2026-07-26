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

const optionalHttpUrl = z
  .union([
    z
      .string()
      .trim()
      .url("Enter a valid URL")
      .refine((value) => /^https?:\/\//i.test(value), {
        message: "URL must start with http:// or https://",
      }),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

/** Returns the URL only when it uses an http(s) scheme; otherwise null. */
export function toSafeHttpUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export const profileBodySchema = z
  .object({
    company_name: z.string().trim().min(1, "Company name is required"),
    city: z.string().trim().min(1, "City is required"),
    description: optionalText,
    instagram_url: optionalHttpUrl,
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
