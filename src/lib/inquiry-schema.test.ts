import { describe, expect, it } from "vitest";

import { parseInquiryBody } from "./inquiry-schema";

describe("parseInquiryBody", () => {
  it("accepts a valid inquiry and strips the honeypot field", () => {
    const result = parseInquiryBody({
      decorator_profile_id: "11111111-1111-1111-1111-111111111111",
      client_name: "Anna Client",
      client_email: "anna@example.com",
      client_phone: "",
      event_date: "2026-08-20",
      needs_description: "Need floral decor for an outdoor wedding.",
      company_website: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        decorator_profile_id: "11111111-1111-1111-1111-111111111111",
        client_name: "Anna Client",
        client_email: "anna@example.com",
        client_phone: null,
        event_date: "2026-08-20",
        needs_description: "Need floral decor for an outdoor wedding.",
      });
    }
  });

  it("rejects invalid email, date, and short description", () => {
    const result = parseInquiryBody({
      decorator_profile_id: "11111111-1111-1111-1111-111111111111",
      client_name: "Anna Client",
      client_email: "not-an-email",
      client_phone: null,
      event_date: "2026-99-99",
      needs_description: "Too short",
      company_website: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("client_email"))).toBe(true);
      expect(result.error.issues.some((issue) => issue.path.includes("event_date"))).toBe(true);
      expect(result.error.issues.some((issue) => issue.path.includes("needs_description"))).toBe(true);
    }
  });
});
