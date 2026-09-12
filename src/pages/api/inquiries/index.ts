import type { APIRoute } from "astro";

import { jsonError } from "@/lib/api-error";
import { consumeInquiryRateLimit, getInquiryClientIp, hasInquiryHoneypotContent } from "@/lib/inquiry-abuse";
import { sendInquiryNotification } from "@/lib/inquiry-email";
import { parseInquiryBody } from "@/lib/inquiry-schema";
import { createClient } from "@/lib/supabase";
import type { ContactInquiry } from "@/types";

export const prerender = false;

function validationFailed(issues: { path: (string | number)[]; message: string }[]) {
  return jsonError("VALIDATION_FAILED", "Invalid inquiry data", 400, {
    fields: Object.fromEntries(issues.map((issue) => [issue.path.join("."), issue.message])),
  });
}

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError("SUPABASE_NOT_CONFIGURED", "Supabase is not configured", 503);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Request body must be valid JSON", 400);
  }

  const honeypotValue =
    body && typeof body === "object" && "company_website" in body
      ? (body as Record<string, unknown>).company_website
      : undefined;
  if (hasInquiryHoneypotContent(honeypotValue)) {
    return new Response(null, { status: 204 });
  }

  const parsed = parseInquiryBody(body);
  if (!parsed.success) {
    return validationFailed(parsed.error.issues);
  }

  const clientIp = getInquiryClientIp(context.request.headers);
  const rateLimit = consumeInquiryRateLimit(clientIp, parsed.data.decorator_profile_id);
  if (rateLimit.limited) {
    return jsonError("RATE_LIMITED", "Too many inquiries sent. Please try again later.", 429, {
      retryAfterMs: Math.max(0, rateLimit.resetAt - Date.now()),
    });
  }

  const profileResult = await supabase
    .from("decorator_profiles")
    .select("id, company_name, contact_email")
    .eq("id", parsed.data.decorator_profile_id)
    .eq("is_published", true)
    .maybeSingle();

  if (profileResult.error) {
    return jsonError("PROFILE_FETCH_FAILED", "Failed to verify decorator profile", 500);
  }

  if (!profileResult.data) {
    return jsonError("PROFILE_NOT_FOUND", "Published decorator profile not found", 404);
  }

  const inquiryId = crypto.randomUUID();
  const insertPayload = {
    id: inquiryId,
    ...parsed.data,
  };

  const insertResult = await supabase.from("contact_inquiries").insert(insertPayload);

  if (insertResult.error) {
    // eslint-disable-next-line no-console -- intentional server log; do not leak to client
    console.error("Failed to create inquiry", insertResult.error);
    return jsonError("INQUIRY_CREATE_FAILED", "Failed to create inquiry", 500);
  }

  const inquiry: ContactInquiry = {
    ...insertPayload,
    created_at: new Date().toISOString(),
  };
  const notification = await sendInquiryNotification({
    to: profileResult.data.contact_email as string | null,
    inquiry,
    profileCompanyName: profileResult.data.company_name as string,
  });

  return Response.json({ inquiry: { id: inquiry.id }, notification }, { status: 201 });
};
