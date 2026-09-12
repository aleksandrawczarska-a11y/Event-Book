import { RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_TO_OVERRIDE } from "astro:env/server";

import type { ContactInquiry } from "@/types";

interface SendInquiryNotificationInput {
  to: string | null;
  inquiry: ContactInquiry;
  profileCompanyName: string;
}

function buildPlainText({ inquiry, profileCompanyName }: SendInquiryNotificationInput): string {
  return [
    `New inquiry for ${profileCompanyName}`,
    "",
    `Client: ${inquiry.client_name}`,
    `Email: ${inquiry.client_email}`,
    `Phone: ${inquiry.client_phone ?? "Not provided"}`,
    `Event date: ${inquiry.event_date}`,
    "",
    "Needs:",
    inquiry.needs_description,
  ].join("\n");
}

export type InquiryNotificationSkipReason = "missing_contact" | "not_configured" | "provider_error";

export type InquiryNotificationResult =
  | { sent: true }
  | { sent: false; reason: InquiryNotificationSkipReason };

export async function sendInquiryNotification(input: SendInquiryNotificationInput): Promise<InquiryNotificationResult> {
  if (!input.to) {
    // Server-side observability for fail-soft notify path.
    // eslint-disable-next-line no-console -- intentional server log
    console.warn("Skipping inquiry email because decorator contact_email is missing", {
      decoratorProfileId: input.inquiry.decorator_profile_id,
      inquiryId: input.inquiry.id,
    });
    return { sent: false, reason: "missing_contact" };
  }

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    // eslint-disable-next-line no-console -- intentional server log
    console.warn("Skipping inquiry email because Resend is not configured", {
      inquiryId: input.inquiry.id,
      decoratorProfileId: input.inquiry.decorator_profile_id,
    });
    return { sent: false, reason: "not_configured" };
  }

  // Empty override must fall through; `??` would keep "".
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- treat "" as unset
  const targetEmail = RESEND_TO_OVERRIDE?.trim() || input.to;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [targetEmail],
        reply_to: input.inquiry.client_email,
        subject: `New EventBook inquiry for ${input.profileCompanyName}`,
        text: buildPlainText(input),
      }),
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console -- intentional server log
      console.error("Failed to send inquiry email", {
        status: response.status,
        body: await response.text(),
        inquiryId: input.inquiry.id,
      });
      return { sent: false, reason: "provider_error" };
    }

    return { sent: true };
  } catch (error) {
    // eslint-disable-next-line no-console -- intentional server log
    console.error("Failed to send inquiry email", error);
    return { sent: false, reason: "provider_error" };
  }
}
