import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function getPortfolioImageUrl(
  supabase: SupabaseClient,
  storagePath: string | null | undefined,
): Promise<string | null> {
  if (!storagePath || storagePath.startsWith("pending/")) {
    return null;
  }

  if (/^https?:\/\//i.test(storagePath)) {
    return storagePath;
  }

  const { data, error } = await supabase.storage.from("portfolio").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function resolvePortfolioEntriesImages<T extends { storage_path: string }>(
  supabase: SupabaseClient,
  entries: T[],
): Promise<(T & { image_url: string | null })[]> {
  return Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      image_url: await getPortfolioImageUrl(supabase, entry.storage_path),
    })),
  );
}
