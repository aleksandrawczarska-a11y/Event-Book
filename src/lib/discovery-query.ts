import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DECORATION_STYLE_OPTIONS,
  EVENT_TYPE_OPTIONS,
  isValidDecorationStyle,
  isValidEventType,
} from "@/lib/decorator-taxonomy";
import type { DecoratorProfile } from "@/types";

export const DISCOVERY_PAGE_SIZE = 24;
/** Hard cap on ?page= to avoid huge PostgREST range offsets. */
export const DISCOVERY_MAX_PAGE = 500;

export interface DiscoveryFilters {
  city: string;
  eventTypes: string[];
  decorationStyles: string[];
  page: number;
}

export interface DiscoveryResult {
  profiles: DecoratorProfile[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: DiscoveryFilters;
}

export function parseDiscoverySearchParams(params: URLSearchParams): DiscoveryFilters {
  const city = (params.get("city") ?? "").trim();
  const eventTypes = params
    .getAll("event")
    .map((value) => value.trim())
    .filter(isValidEventType);
  const decorationStyles = params
    .getAll("style")
    .map((value) => value.trim())
    .filter(isValidDecorationStyle);

  const pageRaw = Number.parseInt(params.get("page") ?? "1", 10);
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, DISCOVERY_MAX_PAGE) : 1;

  return { city, eventTypes, decorationStyles, page };
}

export function buildDiscoverySearchHref(filters: Partial<DiscoveryFilters> & { page?: number }): string {
  const qs = new URLSearchParams();
  if (filters.city?.trim()) {
    qs.set("city", filters.city.trim());
  }
  for (const event of filters.eventTypes ?? []) {
    qs.append("event", event);
  }
  for (const style of filters.decorationStyles ?? []) {
    qs.append("style", style);
  }
  if (filters.page && filters.page > 1) {
    qs.set("page", String(filters.page));
  }
  const query = qs.toString();
  return query ? `/search?${query}` : "/search";
}

function buildPublishedProfilesQuery(supabase: SupabaseClient, filters: DiscoveryFilters) {
  let query = supabase
    .from("decorator_profiles")
    .select(
      "id, user_id, company_name, profile_photo_url, description, city, instagram_url, contact_email, contact_phone, event_types, decoration_styles, is_published, created_at, updated_at",
      { count: "exact" },
    )
    .eq("is_published", true)
    .order("updated_at", { ascending: false });

  if (filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }
  if (filters.eventTypes.length > 0) {
    query = query.overlaps("event_types", filters.eventTypes);
  }
  if (filters.decorationStyles.length > 0) {
    query = query.overlaps("decoration_styles", filters.decorationStyles);
  }

  return query;
}

export async function fetchPublishedDecorators(
  supabase: SupabaseClient,
  filters: DiscoveryFilters,
): Promise<DiscoveryResult> {
  const pageSize = DISCOVERY_PAGE_SIZE;
  const requestedPage = Math.min(Math.max(filters.page, 1), DISCOVERY_MAX_PAGE);
  const from = (requestedPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const first = await buildPublishedProfilesQuery(supabase, filters).range(from, to);

  if (first.error) {
    throw new Error(first.error.message);
  }

  const totalCount = first.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);

  let profiles = first.data as DecoratorProfile[];

  if (page !== requestedPage && totalCount > 0) {
    const clampedFrom = (page - 1) * pageSize;
    const clampedTo = clampedFrom + pageSize - 1;
    const second = await buildPublishedProfilesQuery(supabase, filters).range(clampedFrom, clampedTo);

    if (second.error) {
      throw new Error(second.error.message);
    }

    profiles = second.data as DecoratorProfile[];
  }

  return {
    profiles,
    totalCount,
    page,
    pageSize,
    totalPages,
    filters: { ...filters, page },
  };
}

export const discoveryEventOptions = EVENT_TYPE_OPTIONS;
export const discoveryStyleOptions = DECORATION_STYLE_OPTIONS;
