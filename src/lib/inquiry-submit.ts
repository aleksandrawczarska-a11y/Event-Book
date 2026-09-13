import type { SupabaseClient } from "@supabase/supabase-js";

import { consumeInquiryRateLimit, getInquiryClientIp } from "@/lib/inquiry-abuse";
import { sendInquiryNotification, type InquiryNotificationResult } from "@/lib/inquiry-email";
import { fetchPublishedDecoratorProfile } from "@/lib/inquiry-query";
import type { InquiryBody } from "@/lib/inquiry-schema";
import type { ContactInquiry } from "@/types";

export type SubmitPublishedInquiryResult =
  | { status: "limited"; retryAfterMs: number }
  | { status: "profile_error" }
  | { status: "not_found" }
  | { status: "insert_failed" }
  | { status: "ok"; inquiry: { id: string }; notification: InquiryNotificationResult };

export async function submitPublishedInquiry(
  supabase: SupabaseClient,
  input: InquiryBody,
  headers: Headers,
): Promise<SubmitPublishedInquiryResult> {
  const clientIp = getInquiryClientIp(headers);
  const rateLimit = consumeInquiryRateLimit(clientIp, input.decorator_profile_id);
  if (rateLimit.limited) {
    return { status: "limited", retryAfterMs: Math.max(0, rateLimit.resetAt - Date.now()) };
  }

  const profileResult = await fetchPublishedDecoratorProfile(
    supabase,
    input.decorator_profile_id,
    "id, company_name, contact_email",
  );

  if (profileResult.error) {
    return { status: "profile_error" };
  }

  if (!profileResult.data) {
    return { status: "not_found" };
  }

  const inquiryId = crypto.randomUUID();
  const insertPayload = {
    id: inquiryId,
    ...input,
  };

  const insertResult = await supabase.from("contact_inquiries").insert(insertPayload);

  if (insertResult.error) {
    // eslint-disable-next-line no-console -- intentional server log; do not leak to client
    console.error("Failed to create inquiry", insertResult.error);
    return { status: "insert_failed" };
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

  return { status: "ok", inquiry: { id: inquiry.id }, notification };
}
