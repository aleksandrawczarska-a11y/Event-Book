import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: createClientMock,
}));

function createContext() {
  return {
    request: new Request("http://localhost/api/admin/portfolio/entry-1"),
    cookies: {},
  } as never;
}

function createSupabaseStub(getUserResult: { data: { user: unknown }; error: unknown }) {
  return {
    auth: {
      getUser: vi.fn(() => Promise.resolve(getUserResult)),
    },
  };
}

describe("requireAdmin", () => {
  let requireAdmin: typeof import("./api-auth").requireAdmin;

  beforeEach(async () => {
    createClientMock.mockReset();
    ({ requireAdmin } = await import("./api-auth"));
  });

  it("returns supabase + user when app_metadata.role is exactly 'admin'", async () => {
    const supabase = createSupabaseStub({
      data: { user: { id: "admin-1", app_metadata: { role: "admin" } } },
      error: null,
    });
    createClientMock.mockReturnValue(supabase);

    const result = await requireAdmin(createContext());

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.user.id).toBe("admin-1");
      expect(result.supabase).toBe(supabase);
    }
  });

  it("returns 403 ADMIN_REQUIRED when the user is authenticated but not an admin", async () => {
    const supabase = createSupabaseStub({
      data: { user: { id: "user-1", app_metadata: {} } },
      error: null,
    });
    createClientMock.mockReturnValue(supabase);

    const result = await requireAdmin(createContext());

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(403);
      const body = (await result.error.json()) as { error: { code: string } };
      expect(body.error.code).toBe("ADMIN_REQUIRED");
    }
  });

  it("rejects a role value that merely resembles admin (fail-closed)", async () => {
    const supabase = createSupabaseStub({
      data: { user: { id: "user-2", app_metadata: { role: "Admin" } } },
      error: null,
    });
    createClientMock.mockReturnValue(supabase);

    const result = await requireAdmin(createContext());

    expect("error" in result).toBe(true);
  });

  it("delegates to requireAuth and returns 401 when there is no user", async () => {
    const supabase = createSupabaseStub({ data: { user: null }, error: null });
    createClientMock.mockReturnValue(supabase);

    const result = await requireAdmin(createContext());

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(401);
      const body = (await result.error.json()) as { error: { code: string } };
      expect(body.error.code).toBe("AUTH_REQUIRED");
    }
  });

  it("returns 503 SUPABASE_NOT_CONFIGURED when the client is unavailable", async () => {
    createClientMock.mockReturnValue(null);

    const result = await requireAdmin(createContext());

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(503);
    }
  });
});
