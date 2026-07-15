import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Stored avatar values are either a storage object path or a legacy http(s) URL. */
export function isStorageObjectPath(value: string): boolean {
  return !/^https?:\/\//i.test(value);
}

export async function resolveProfilePhotoUrl(
  supabase: SupabaseClient,
  profilePhotoUrl: string | null,
): Promise<string | null> {
  if (!profilePhotoUrl) {
    return null;
  }

  if (!isStorageObjectPath(profilePhotoUrl)) {
    return profilePhotoUrl;
  }

  const { data, error } = await supabase.storage
    .from("profiles")
    .createSignedUrl(profilePhotoUrl, SIGNED_URL_TTL_SECONDS);

  if (error || !data.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
