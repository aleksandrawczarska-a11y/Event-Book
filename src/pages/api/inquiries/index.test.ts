import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const sendInquiryNotificationMock = vi.fn();
const consumeInquiryRateLimitMock = vi.fn();
const getInquiryClientIpMock = vi.fn();
const hasInquiryHoneypotContentMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/inquiry-email", () => ({
  sendInquiryNotification: sendInquiryNotificationMock,
}));

vi.mock("@/lib/inquiry-abuse", () => ({
  consumeInquiryRateLimit: consumeInquiryRateLimitMock,
  getInquiryClientIp: getInquiryClientIpMock,
  hasInquiryHoneypotContent: hasInquiryHoneypotContentMock,
}));

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

function createContext(body: unknown) {
  return {
    request: new Request("http://localhost/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {},
  } as never;
}

describe("POST /api/inquiries", () => {
  let POST: typeof import("./index").POST;

  beforeEach(() => {
    createClientMock.mockReset();
    sendInquiryNotificationMock.mockReset();
    consumeInquiryRateLimitMock.mockReset();
    getInquiryClientIpMock.mockReset();
    hasInquiryHoneypotContentMock.mockReset();

    hasInquiryHoneypotContentMock.mockReturnValue(false);
    getInquiryClientIpMock.mockReturnValue("203.0.113.10");
    consumeInquiryRateLimitMock.mockReturnValue({ limited: false, remaining: 4, resetAt: Date.now() + 60_000 });
    sendInquiryNotificationMock.mockResolvedValue({ sent: true });
  });

  beforeEach(async () => {
    ({ POST } = await import("./index"));
  });

  it("returns 503 when Supabase is not configured", async () => {
    createClientMock.mockReturnValue(null);

    const response = await POST(
      createContext({
        decorator_profile_id: "11111111-1111-1111-1111-111111111111",
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
    hasInquiryHoneypotContentMock.mockReturnValue(true);

    const response = await POST(
      createContext({
        decorator_profile_id: "11111111-1111-1111-1111-111111111111",
        client_name: "Anna Client",
        client_email: "anna@example.com",
        event_date: "2026-08-20",
        needs_description: "Need floral decor for an outdoor wedding.",
        company_website: "https://spam.example",
      }),
    );

    expect(response.status).toBe(204);
    expect(consumeInquiryRateLimitMock).not.toHaveBeenCalled();
  });

  it("creates an inquiry and triggers an email notification", async () => {
    const decoratorProfileQuery = createDecoratorProfileQuery({
      data: {
        id: "11111111-1111-1111-1111-111111111111",
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
        decorator_profile_id: "11111111-1111-1111-1111-111111111111",
        client_name: "Anna Client",
        client_email: "anna@example.com",
        client_phone: "",
        event_date: "2026-08-20",
        needs_description: "Need floral decor for an outdoor wedding.",
        company_website: "",
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { inquiry: { id: string } };
    expect(body.inquiry.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(inquiryInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: body.inquiry.id,
        decorator_profile_id: "11111111-1111-1111-1111-111111111111",
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
        decorator_profile_id: "11111111-1111-1111-1111-111111111111",
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
        id: "11111111-1111-1111-1111-111111111111",
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
        decorator_profile_id: "11111111-1111-1111-1111-111111111111",
        client_name: "Anna Client",
        client_email: "anna@example.com",
        event_date: "2026-08-20",
        needs_description: "Need floral decor for an outdoor wedding.",
        company_website: "",
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { inquiry: { id: string } };
    expect(body.inquiry.id).toBeTruthy();
    expect(sendInquiryNotificationMock).toHaveBeenCalled();
  });
});
