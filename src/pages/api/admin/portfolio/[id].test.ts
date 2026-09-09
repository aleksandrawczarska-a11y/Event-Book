import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: requireAdminMock,
}));

function createContext(id: string | undefined, body: unknown) {
  return {
    params: { id },
    request: new Request(`http://localhost/api/admin/portfolio/${id ?? ""}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as never;
}

function createPortfolioQuery(options: {
  existing?: { data: { id: string } | null; error: unknown };
  update?: { error: unknown };
}) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(options.existing ?? { data: { id: "entry-1" }, error: null }));
  builder.update = vi.fn(() => {
    const updateBuilder: Record<string, unknown> = {};
    updateBuilder.eq = vi.fn(() => Promise.resolve(options.update ?? { error: null }));
    return updateBuilder;
  });
  return builder;
}

describe("PATCH /api/admin/portfolio/[id]", () => {
  let PATCH: typeof import("./[id]").PATCH;

  beforeEach(async () => {
    requireAdminMock.mockReset();
    ({ PATCH } = await import("./[id]"));
  });

  it("returns requireAdmin error when caller is not an admin", async () => {
    requireAdminMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: { code: "ADMIN_REQUIRED", message: "Admin access required" } }), {
        status: 403,
      }),
    });

    const response = await PATCH(createContext("entry-1", { moderation_status: "approved" }));

    expect(response.status).toBe(403);
  });

  it("rejects invalid moderation_status", async () => {
    requireAdminMock.mockResolvedValue({
      supabase: { from: vi.fn() },
      user: { id: "admin-1", app_metadata: { role: "admin" } },
    });

    const response = await PATCH(createContext("entry-1", { moderation_status: "pending" }));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns 404 when the entry does not exist", async () => {
    const query = createPortfolioQuery({ existing: { data: null, error: null } });
    requireAdminMock.mockResolvedValue({
      supabase: { from: vi.fn(() => query) },
      user: { id: "admin-1", app_metadata: { role: "admin" } },
    });

    const response = await PATCH(createContext("missing", { moderation_status: "approved" }));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("PORTFOLIO_NOT_FOUND");
  });

  it("approves an entry and returns the new status", async () => {
    const query = createPortfolioQuery({});
    requireAdminMock.mockResolvedValue({
      supabase: { from: vi.fn(() => query) },
      user: { id: "admin-1", app_metadata: { role: "admin" } },
    });

    const response = await PATCH(createContext("entry-1", { moderation_status: "approved" }));
    const body = (await response.json()) as { entry: { id: string; moderation_status: string } };

    expect(response.status).toBe(200);
    expect(body.entry).toEqual({ id: "entry-1", moderation_status: "approved" });
    expect(query.update).toHaveBeenCalledWith({ moderation_status: "approved" });
  });

  it("rejects an entry and returns the new status", async () => {
    const query = createPortfolioQuery({});
    requireAdminMock.mockResolvedValue({
      supabase: { from: vi.fn(() => query) },
      user: { id: "admin-1", app_metadata: { role: "admin" } },
    });

    const response = await PATCH(createContext("entry-1", { moderation_status: "rejected" }));
    const body = (await response.json()) as { entry: { id: string; moderation_status: string } };

    expect(response.status).toBe(200);
    expect(body.entry).toEqual({ id: "entry-1", moderation_status: "rejected" });
  });
});
