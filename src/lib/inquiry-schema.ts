import { z } from "zod";

const optionalPhone = z.union([z.string().trim(), z.literal(""), z.null(), z.undefined()]).transform((value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
});

const optionalHoneypot = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""));

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Event date must use YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "Event date must be a valid date",
  });

const inquiryBodySchema = z
  .object({
    decorator_profile_id: z.string().uuid("Decorator profile id must be a valid UUID"),
    client_name: z.string().trim().min(1, "Name is required"),
    client_email: z.string().trim().email("Enter a valid email address"),
    client_phone: optionalPhone,
    event_date: isoDate,
    needs_description: z.string().trim().min(10, "Needs description must be at least 10 characters"),
    company_website: optionalHoneypot,
  })
  .transform(({ company_website: _companyWebsite, ...data }) => data);

export type InquiryBody = z.infer<typeof inquiryBodySchema>;

export function parseInquiryBody(input: unknown) {
  return inquiryBodySchema.safeParse(input);
}
