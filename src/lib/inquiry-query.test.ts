import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchPublishedDecoratorProfile, INQUIRIES_PAGE_LIMIT, listInquiriesForProfile } from "@/lib/inquiry-query";
import type { ContactInquiry, DecoratorProfile } from "@/types";

const PROFILE_ID = "11111111-1111-1111-1111-111111111111";

const sampleProfile = {
  id: PROFILE_ID,
  company_name: "Studio A",
  contact_email: "decorator@example.com",
  is_published: true,
} as DecoratorProfile;

function createPublishedProfileQueryMock(result: { data: unknown; error: { message: string } | null }) {
  const calls = {
    select: [] as unknown[],
    eq: [] as unknown[][],
    maybeSingle: 0,
  };

  const builder: Record<string, unknown> = {};
  builder.select = vi.fn((columns: string) => {
    calls.select.push(columns);
    return builder;
  });
  builder.eq = vi.fn((...args: unknown[]) => {
    calls.eq.push(args);
    return builder;
  });
  builder.maybeSingle = vi.fn(() => {
    calls.maybeSingle += 1;
    return Promise.resolve(result);
  });

  const from = vi.fn(() => builder);
  const supabase = { from } as unknown as SupabaseClient;

  return { supabase, from, calls, builder };
}

function createInquiryListQueryMock(result: { data: unknown; error: { message: string } | null }) {
  const calls = {
    select: [] as unknown[],
    eq: [] as unknown[][],
    order: [] as unknown[][],
    limit: [] as number[],
  };

  const builder: Record<string, unknown> = {};
  builder.select = vi.fn((columns: string) => {
    calls.select.push(columns);
    return builder;
  });
  builder.eq = vi.fn((...args: unknown[]) => {
    calls.eq.push(args);
    return builder;
  });
  builder.order = vi.fn((...args: unknown[]) => {
    calls.order.push(args);
    return builder;
  });
  builder.limit = vi.fn((value: number) => {
    calls.limit.push(value);
    return Promise.resolve(result);
  });

  const from = vi.fn(() => builder);
  const supabase = { from } as unknown as SupabaseClient;

  return { supabase, from, calls };
}

function makeInquiry(suffix: string): ContactInquiry {
  return {
    id: `22222222-2222-2222-2222-22222222222${suffix}`,
    decorator_profile_id: PROFILE_ID,
    client_name: `Client ${suffix}`,
    client_email: `client${suffix}@example.com`,
    client_phone: null,
    event_date: "2026-08-20",
    needs_description: "Need floral decor for an outdoor wedding.",
    created_at: `2026-06-0${suffix}T10:00:00.000Z`,
  };
}

describe("fetchPublishedDecoratorProfile", () => {
  it("loads a published profile by id with default columns and maybeSingle", async () => {
    const { supabase, from, calls } = createPublishedProfileQueryMock({
      data: sampleProfile,
      error: null,
    });

    const result = await fetchPublishedDecoratorProfile(supabase, PROFILE_ID);

    expect(from).toHaveBeenCalledWith("decorator_profiles");
    expect(calls.select).toEqual(["*"]);
    expect(calls.eq).toEqual([
      ["id", PROFILE_ID],
      ["is_published", true],
    ]);
    expect(calls.maybeSingle).toBe(1);
    expect(result).toEqual({ data: sampleProfile, error: null });
  });

  it("passes the caller column list through (handler-shaped select)", async () => {
    const { supabase, calls } = createPublishedProfileQueryMock({
      data: { id: PROFILE_ID, company_name: "Studio A", contact_email: "decorator@example.com" },
      error: null,
    });

    const result = await fetchPublishedDecoratorProfile(supabase, PROFILE_ID, "id, company_name, contact_email");

    expect(calls.select).toEqual(["id, company_name, contact_email"]);
    expect(result.data).toEqual({
      id: PROFILE_ID,
      company_name: "Studio A",
      contact_email: "decorator@example.com",
    });
  });

  it("returns null data when the profile is unpublished or missing", async () => {
    const { supabase, calls } = createPublishedProfileQueryMock({
      data: null,
      error: null,
    });

    const result = await fetchPublishedDecoratorProfile(supabase, PROFILE_ID);

    expect(calls.eq).toContainEqual(["is_published", true]);
    expect(result).toEqual({ data: null, error: null });
  });

  it("surfaces the query error without inventing a profile", async () => {
    const { supabase } = createPublishedProfileQueryMock({
      data: null,
      error: { message: "boom" },
    });

    await expect(fetchPublishedDecoratorProfile(supabase, PROFILE_ID)).resolves.toEqual({
      data: null,
      error: { message: "boom" },
    });
  });
});

describe("listInquiriesForProfile", () => {
  it("lists owner inquiries newest first with limit+1", async () => {
    const rows = [makeInquiry("1"), makeInquiry("2")];
    const { supabase, from, calls } = createInquiryListQueryMock({
      data: rows,
      error: null,
    });

    const result = await listInquiriesForProfile(supabase, PROFILE_ID);

    expect(from).toHaveBeenCalledWith("contact_inquiries");
    expect(calls.select).toEqual(["*"]);
    expect(calls.eq).toEqual([["decorator_profile_id", PROFILE_ID]]);
    expect(calls.order).toEqual([["created_at", { ascending: false }]]);
    expect(calls.limit).toEqual([INQUIRIES_PAGE_LIMIT + 1]);
    expect(result.inquiries).toEqual(rows);
    expect(result.hasMoreThanLimit).toBe(false);
    expect(result.error).toBeNull();
  });

  it("slices to the page limit and flags overflow when one extra row exists", async () => {
    const rows = Array.from({ length: INQUIRIES_PAGE_LIMIT + 1 }, (_, index) => makeInquiry(String(index % 9)));
    const { supabase, calls } = createInquiryListQueryMock({
      data: rows,
      error: null,
    });

    const result = await listInquiriesForProfile(supabase, PROFILE_ID);

    expect(calls.limit).toEqual([INQUIRIES_PAGE_LIMIT + 1]);
    expect(result.inquiries).toHaveLength(INQUIRIES_PAGE_LIMIT);
    expect(result.inquiries).toEqual(rows.slice(0, INQUIRIES_PAGE_LIMIT));
    expect(result.hasMoreThanLimit).toBe(true);
  });

  it("honors an explicit limit for the overflow contract", async () => {
    const rows = [makeInquiry("1"), makeInquiry("2"), makeInquiry("3")];
    const { supabase, calls } = createInquiryListQueryMock({
      data: rows,
      error: null,
    });

    const result = await listInquiriesForProfile(supabase, PROFILE_ID, 2);

    expect(calls.limit).toEqual([3]);
    expect(result.inquiries).toEqual(rows.slice(0, 2));
    expect(result.hasMoreThanLimit).toBe(true);
  });

  it("returns an empty owner list when there are no rows", async () => {
    const { supabase } = createInquiryListQueryMock({
      data: [],
      error: null,
    });

    await expect(listInquiriesForProfile(supabase, PROFILE_ID)).resolves.toEqual({
      inquiries: [],
      hasMoreThanLimit: false,
      error: null,
    });
  });

  it("surfaces the query error with an empty list shape", async () => {
    const { supabase } = createInquiryListQueryMock({
      data: null,
      error: { message: "boom" },
    });

    await expect(listInquiriesForProfile(supabase, PROFILE_ID)).resolves.toEqual({
      inquiries: [],
      hasMoreThanLimit: false,
      error: { message: "boom" },
    });
  });
});
