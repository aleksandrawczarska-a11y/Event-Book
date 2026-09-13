import type { APIRoute } from "astro";

import { jsonError } from "@/lib/api-error";
import { hasInquiryHoneypotContent } from "@/lib/inquiry-abuse";
import { parseInquiryBody } from "@/lib/inquiry-schema";
import { submitPublishedInquiry } from "@/lib/inquiry-submit";
import { createClient } from "@/lib/supabase";

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

  const result = await submitPublishedInquiry(supabase, parsed.data, context.request.headers);

  if (result.status === "limited") {
    return jsonError("RATE_LIMITED", "Too many inquiries sent. Please try again later.", 429, {
      retryAfterMs: result.retryAfterMs,
    });
  }

  if (result.status === "profile_error") {
    return jsonError("PROFILE_FETCH_FAILED", "Failed to verify decorator profile", 500);
  }

  if (result.status === "not_found") {
    return jsonError("PROFILE_NOT_FOUND", "Published decorator profile not found", 404);
  }

  if (result.status === "insert_failed") {
    return jsonError("INQUIRY_CREATE_FAILED", "Failed to create inquiry", 500);
  }

  return Response.json({ inquiry: { id: result.inquiry.id }, notification: result.notification }, { status: 201 });
};
