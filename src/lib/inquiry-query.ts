import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContactInquiry } from "@/types";

export const INQUIRIES_PAGE_LIMIT = 50;

export async function fetchPublishedDecoratorProfile(supabase: SupabaseClient, id: string, columns = "*") {
  const result = await supabase
    .from("decorator_profiles")
    .select(columns)
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  return { data: result.data, error: result.error };
}

export async function listInquiriesForProfile(
  supabase: SupabaseClient,
  profileId: string,
  limit = INQUIRIES_PAGE_LIMIT,
) {
  const result = await supabase
    .from("contact_inquiries")
    .select("*")
    .eq("decorator_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (result.error) {
    return { inquiries: [] as ContactInquiry[], hasMoreThanLimit: false, error: result.error };
  }

  const rows = result.data as ContactInquiry[];
  return {
    inquiries: rows.slice(0, limit),
    hasMoreThanLimit: rows.length > limit,
    error: null,
  };
}
