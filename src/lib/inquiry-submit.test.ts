import { beforeEach, describe, expect, it, vi } from "vitest";

import { RATE_LIMIT_MAX_REQUESTS, resetInquiryRateLimitBuckets } from "@/lib/inquiry-abuse";
import type { InquiryBody } from "@/lib/inquiry-schema";
import { submitPublishedInquiry } from "@/lib/inquiry-submit";

const { sendInquiryNotificationMock } = vi.hoisted(() => ({
  sendInquiryNotificationMock: vi.fn(),
}));

vi.mock("@/lib/inquiry-email", () => ({
  sendInquiryNotification: sendInquiryNotificationMock,
}));

const DECORATOR_PROFILE_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_IP = "203.0.113.10";

const input: InquiryBody = {
  decorator_profile_id: DECORATOR_PROFILE_ID,
  client_name: "Anna Client",
  client_email: "anna@example.com",
  client_phone: null,
  event_date: "2026-08-20",
  needs_description: "Need floral decor for an outdoor wedding.",
};

function headersWithIp() {
  return new Headers({ "cf-connecting-ip": CLIENT_IP });
}

function createDecoratorProfileQuery(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  return builder;
}

function createContactInquiryQuery(result: { error: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.insert = vi.fn(() => Promise.resolve(result));
  return builder;
}

describe("submitPublishedInquiry", () => {
  beforeEach(() => {
    resetInquiryRateLimitBuckets();
    sendInquiryNotificationMock.mockReset();
    sendInquiryNotificationMock.mockResolvedValue({ sent: true });
  });

  it("returns limited without insert once the budget is spent", async () => {
    const insertQuery = createContactInquiryQuery({ error: null });
    const profileQuery = createDecoratorProfileQuery({
      data: { id: DECORATOR_PROFILE_ID, company_name: "Studio A", contact_email: "decorator@example.com" },
      error: null,
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "decorator_profiles") {
          return profileQuery;
        }
        if (table === "contact_inquiries") {
          return insertQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
      const allowed = await submitPublishedInquiry(supabase as never, input, headersWithIp());
      expect(allowed.status).toBe("ok");
    }

    expect(insertQuery.insert).toHaveBeenCalledTimes(RATE_LIMIT_MAX_REQUESTS);

    const limited = await submitPublishedInquiry(supabase as never, input, headersWithIp());
    expect(limited.status).toBe("limited");
    expect(insertQuery.insert).toHaveBeenCalledTimes(RATE_LIMIT_MAX_REQUESTS);
  });

  it("returns not_found when the profile is unpublished", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "decorator_profiles") {
          return createDecoratorProfileQuery({ data: null, error: null });
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await submitPublishedInquiry(supabase as never, input, headersWithIp());
    expect(result).toEqual({ status: "not_found" });
    expect(sendInquiryNotificationMock).not.toHaveBeenCalled();
  });

  it("returns insert_failed when persist errors", async () => {
    const insertQuery = createContactInquiryQuery({ error: { message: "boom" } });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "decorator_profiles") {
          return createDecoratorProfileQuery({
            data: { id: DECORATOR_PROFILE_ID, company_name: "Studio A", contact_email: "decorator@example.com" },
            error: null,
          });
        }
        if (table === "contact_inquiries") {
          return insertQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await submitPublishedInquiry(supabase as never, input, headersWithIp());
    expect(result).toEqual({ status: "insert_failed" });
    expect(sendInquiryNotificationMock).not.toHaveBeenCalled();
  });

  it("returns ok with inquiry id and notification on the happy path", async () => {
    const insertQuery = createContactInquiryQuery({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "decorator_profiles") {
          return createDecoratorProfileQuery({
            data: { id: DECORATOR_PROFILE_ID, company_name: "Studio A", contact_email: "decorator@example.com" },
            error: null,
          });
        }
        if (table === "contact_inquiries") {
          return insertQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await submitPublishedInquiry(supabase as never, input, headersWithIp());
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.inquiry.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(result.notification).toEqual({ sent: true });
    }
    expect(insertQuery.insert).toHaveBeenCalledOnce();
    expect(sendInquiryNotificationMock).toHaveBeenCalledOnce();
  });

  it("returns ok when email delivery fails after insert", async () => {
    sendInquiryNotificationMock.mockResolvedValue({ sent: false, reason: "provider_error" });
    const insertQuery = createContactInquiryQuery({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "decorator_profiles") {
          return createDecoratorProfileQuery({
            data: { id: DECORATOR_PROFILE_ID, company_name: "Studio A", contact_email: "decorator@example.com" },
            error: null,
          });
        }
        if (table === "contact_inquiries") {
          return insertQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await submitPublishedInquiry(supabase as never, input, headersWithIp());
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.notification).toEqual({ sent: false, reason: "provider_error" });
    }
    expect(insertQuery.insert).toHaveBeenCalledOnce();
  });
});
