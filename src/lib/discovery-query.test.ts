import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildDiscoverySearchHref,
  DISCOVERY_MAX_PAGE,
  DISCOVERY_PAGE_SIZE,
  fetchPublishedDecorators,
  parseDiscoverySearchParams,
} from "@/lib/discovery-query";
import type { DecoratorProfile } from "@/types";

describe("parseDiscoverySearchParams", () => {
  it("parses city, multi filters, and page", () => {
    const params = new URLSearchParams("city=Warszawa&event=Wesele&event=Urodziny&style=Boho&page=2");
    expect(parseDiscoverySearchParams(params)).toEqual({
      city: "Warszawa",
      eventTypes: ["Wesele", "Urodziny"],
      decorationStyles: ["Boho"],
      page: 2,
    });
  });

  it("drops invalid taxonomy values and clamps bad page", () => {
    const params = new URLSearchParams("event=Nope&style=AlsoNope&page=0");
    expect(parseDiscoverySearchParams(params)).toEqual({
      city: "",
      eventTypes: [],
      decorationStyles: [],
      page: 1,
    });
  });

  it("caps absurdly large page values", () => {
    const params = new URLSearchParams(`page=${DISCOVERY_MAX_PAGE + 999}`);
    expect(parseDiscoverySearchParams(params).page).toBe(DISCOVERY_MAX_PAGE);
  });
});

describe("buildDiscoverySearchHref", () => {
  it("omits page=1 and empty filters", () => {
    expect(buildDiscoverySearchHref({ city: "", eventTypes: [], decorationStyles: [], page: 1 })).toBe("/search");
  });

  it("serializes filters and page>1", () => {
    expect(
      buildDiscoverySearchHref({
        city: "Kraków",
        eventTypes: ["Wesele"],
        decorationStyles: ["Boho"],
        page: 3,
      }),
    ).toBe("/search?city=Krak%C3%B3w&event=Wesele&style=Boho&page=3");
  });
});

describe("fetchPublishedDecorators", () => {
  const sampleProfile = {
    id: "11111111-1111-1111-1111-111111111111",
    company_name: "Studio A",
    city: "Warszawa",
  } as DecoratorProfile;

  function createQueryMock(options: {
    ranges: {
      from: number;
      to: number;
      data: DecoratorProfile[];
      count: number;
      error?: { message: string } | null;
    }[];
  }) {
    const calls = {
      eq: [] as unknown[][],
      ilike: [] as unknown[][],
      overlaps: [] as unknown[][],
      order: [] as unknown[][],
      range: [] as [number, number][],
    };

    let rangeIndex = 0;

    const createBuilder = () => {
      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn((...args: unknown[]) => {
        calls.eq.push(args);
        return builder;
      });
      builder.ilike = vi.fn((...args: unknown[]) => {
        calls.ilike.push(args);
        return builder;
      });
      builder.overlaps = vi.fn((...args: unknown[]) => {
        calls.overlaps.push(args);
        return builder;
      });
      builder.order = vi.fn((...args: unknown[]) => {
        calls.order.push(args);
        return builder;
      });
      builder.range = vi.fn((from: number, to: number) => {
        calls.range.push([from, to]);
        const index = Math.min(rangeIndex, options.ranges.length - 1);
        const response = options.ranges[index];
        rangeIndex += 1;
        return Promise.resolve({
          data: response.data,
          count: response.count,
          error: response.error ?? null,
        });
      });
      return builder;
    };

    const from = vi.fn(() => createBuilder());
    const supabase = { from } as unknown as SupabaseClient;

    return { supabase, from, calls };
  }

  it("filters published profiles and applies city/event/style filters", async () => {
    const { supabase, from, calls } = createQueryMock({
      ranges: [{ from: 0, to: DISCOVERY_PAGE_SIZE - 1, data: [sampleProfile], count: 1 }],
    });

    const result = await fetchPublishedDecorators(supabase, {
      city: "Warszawa",
      eventTypes: ["Wesele"],
      decorationStyles: ["Boho"],
      page: 1,
    });

    expect(from).toHaveBeenCalledWith("decorator_profiles");
    expect(calls.eq).toContainEqual(["is_published", true]);
    expect(calls.ilike).toContainEqual(["city", "%Warszawa%"]);
    expect(calls.overlaps).toEqual(
      expect.arrayContaining([
        ["event_types", ["Wesele"]],
        ["decoration_styles", ["Boho"]],
      ]),
    );
    expect(calls.order).toContainEqual(["updated_at", { ascending: false }]);
    expect(calls.range).toEqual([[0, DISCOVERY_PAGE_SIZE - 1]]);
    expect(result.profiles).toEqual([sampleProfile]);
    expect(result.totalCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("re-queries with clamped range when page exceeds totalPages", async () => {
    const pageSize = DISCOVERY_PAGE_SIZE;
    const totalCount = pageSize + 1; // 2 pages
    const lastPageProfile: DecoratorProfile = { ...sampleProfile, company_name: "Studio Last" };

    const { supabase, calls } = createQueryMock({
      ranges: [
        { from: pageSize * 9, to: pageSize * 10 - 1, data: [], count: totalCount },
        { from: pageSize, to: pageSize * 2 - 1, data: [lastPageProfile], count: totalCount },
      ],
    });

    const result = await fetchPublishedDecorators(supabase, {
      city: "",
      eventTypes: [],
      decorationStyles: [],
      page: 10,
    });

    expect(calls.range).toEqual([
      [pageSize * 9, pageSize * 10 - 1],
      [pageSize, pageSize * 2 - 1],
    ]);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.profiles).toEqual([lastPageProfile]);
    expect(result.filters.page).toBe(2);
  });

  it("throws when the query returns an error", async () => {
    const { supabase } = createQueryMock({
      ranges: [{ from: 0, to: DISCOVERY_PAGE_SIZE - 1, data: [], count: 0, error: { message: "boom" } }],
    });

    await expect(
      fetchPublishedDecorators(supabase, {
        city: "",
        eventTypes: [],
        decorationStyles: [],
        page: 1,
      }),
    ).rejects.toThrow("boom");
  });
});
