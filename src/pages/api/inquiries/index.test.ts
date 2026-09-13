import { beforeEach, describe, expect, it, vi } from "vitest";

import { RATE_LIMIT_MAX_REQUESTS, consumeInquiryRateLimit, resetInquiryRateLimitBuckets } from "@/lib/inquiry-abuse";

const createClientMock = vi.fn();
const sendInquiryNotificationMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/inquiry-email", () => ({
  sendInquiryNotification: sendInquiryNotificationMock,
}));

const CLIENT_IP = "203.0.113.10";
const DECORATOR_PROFILE_ID = "11111111-1111-1111-1111-111111111111";

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

function createInquiryRequest(body: unknown) {
  return new Request("http://localhost/api/inquiries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": CLIENT_IP,
    },
    body: JSON.stringify(body),
  });
}

function createContext(body: unknown) {
  return {
    request: createInquiryRequest(body),
    cookies: {},
  } as never;
}

describe("POST /api/inquiries", () => {
  let POST: typeof import("./index").POST;

  beforeEach(() => {
    resetInquiryRateLimitBuckets();
    createClientMock.mockReset();
    sendInquiryNotificationMock.mockReset();
    sendInquiryNotificationMock.mockResolvedValue({ sent: true });
  });

  beforeEach(async () => {
    ({ POST } = await import("./index"));
  });

  it("stamps cf-connecting-ip on createContext so the live limiter keys the request", () => {
    const request = createInquiryRequest({ decorator_profile_id: DECORATOR_PROFILE_ID });
    expect(request.headers.get("cf-connecting-ip")).toBe(CLIENT_IP);
  });

  it("fills the live limiter so later cases fail unless beforeEach resets the Map", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
      expect(consumeInquiryRateLimit(CLIENT_IP, DECORATOR_PROFILE_ID).limited).toBe(false);
    }
    expect(consumeInquiryRateLimit(CLIENT_IP, DECORATOR_PROFILE_ID).limited).toBe(true);
  });

  it("returns 503 when Supabase is not configured", async () => {
    createClientMock.mockReturnValue(null);

    const response = await POST(
      createContext({
        decorator_profile_id: DECORATOR_PROFILE_ID,
        client_name: "Anna Client",
        client_email: "anna@example.com",
        client_phone: "",
        event_date: "2026-08-20",
        needs_description: "Need floral decor for an outdoor wedding.",
        company_website: "",
      }),
    );

    expect(response.status).toBe(503);
  });

  it("silently drops honeypot submissions", async () => {
    createClientMock.mockReturnValue({});

    const response = await POST(
      createContext({
        decorator_profile_id: DECORATOR_PROFILE_ID,
        client_name: "Anna Client",
        client_email: "anna@example.com",
        event_date: "2026-08-20",
        needs_description: "Need floral decor for an outdoor wedding.",
        company_website: "https://spam.example",
      }),
    );

    expect(response.status).toBe(204);
    const probe = consumeInquiryRateLimit(CLIENT_IP, DECORATOR_PROFILE_ID);
    expect(probe.limited).toBe(false);
    expect(probe.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1);
  });

  it("creates an inquiry and triggers an email notification", async () => {
    const decoratorProfileQuery = createDecoratorProfileQuery({
      data: {
        id: DECORATOR_PROFILE_ID,
        company_name: "Studio A",
        contact_email: "decorator@example.com",
      },
      error: null,
    });
    const inquiryInsertQuery = createContactInquiryQuery({
      error: null,
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "decorator_profiles") {
          return decoratorProfileQuery;
        }
        if (table === "contact_inquiries") {
          return inquiryInsertQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      createContext({
        decorator_profile_id: DECORATOR_PROFILE_ID,
        client_name: "Anna Client",
        client_email: "anna@example.com",
        client_phone: "",
        event_date: "2026-08-20",
        needs_description: "Need floral decor for an outdoor wedding.",
        company_website: "",
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { inquiry: { id: string }; notification: { sent: boolean } };
    expect(body.inquiry.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.notification).toEqual({ sent: true });
    expect(inquiryInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: body.inquiry.id,
        decorator_profile_id: DECORATOR_PROFILE_ID,
        client_name: "Anna Client",
        client_email: "anna@example.com",
      }),
    );
    expect(sendInquiryNotificationMock).toHaveBeenCalledOnce();
    expect(sendInquiryNotificationMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        to: "decorator@example.com",
        profileCompanyName: "Studio A",
      }),
    );
    const probe = consumeInquiryRateLimit(CLIENT_IP, DECORATOR_PROFILE_ID);
    expect(probe.limited).toBe(false);
    expect(probe.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 2);
  });

  it("rejects unpublished decorator profiles", async () => {
    const decoratorProfileQuery = createDecoratorProfileQuery({
      data: null,
      error: null,
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "decorator_profiles") {
          return decoratorProfileQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      createContext({
        decorator_profile_id: DECORATOR_PROFILE_ID,
        client_name: "Anna Client",
        client_email: "anna@example.com",
        event_date: "2026-08-20",
        needs_description: "Need floral decor for an outdoor wedding.",
        company_website: "",
      }),
    );

    expect(response.status).toBe(404);
    expect(sendInquiryNotificationMock).not.toHaveBeenCalled();
  });

  it("returns success even when email delivery fails after insert", async () => {
    sendInquiryNotificationMock.mockResolvedValue({ sent: false });

    const decoratorProfileQuery = createDecoratorProfileQuery({
      data: {
        id: DECORATOR_PROFILE_ID,
        company_name: "Studio A",
        contact_email: "decorator@example.com",
      },
      error: null,
    });
    const inquiryInsertQuery = createContactInquiryQuery({
      error: null,
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "decorator_profiles") {
          return decoratorProfileQuery;
        }
        if (table === "contact_inquiries") {
          return inquiryInsertQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      createContext({
        decorator_profile_id: DECORATOR_PROFILE_ID,
        client_name: "Anna Client",
        client_email: "anna@example.com",
        event_date: "2026-08-20",
        needs_description: "Need floral decor for an outdoor wedding.",
        company_website: "",
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { inquiry: { id: string }; notification: { sent: boolean } };
    expect(body.inquiry.id).toBeTruthy();
    expect(body.notification).toEqual({ sent: false });
    expect(sendInquiryNotificationMock).toHaveBeenCalled();
  });
});
